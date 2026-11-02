package apiserver

import (
	"encoding/binary"
	"errors"
	"io"
	"math"
	"time"
)

const quickTimeUnixEpochOffset = int64(2_082_844_800)

type mp4BoxHeader struct {
	payloadSize uint64
	typ         [4]byte
	toEOF       bool
}

func readMP4BoxHeader(reader io.Reader) (mp4BoxHeader, error) {
	var encoded [8]byte
	if _, err := io.ReadFull(reader, encoded[:]); err != nil {
		return mp4BoxHeader{}, err
	}
	size := uint64(binary.BigEndian.Uint32(encoded[:4]))
	headerSize := uint64(8)
	var typ [4]byte
	copy(typ[:], encoded[4:])
	if size == 0 {
		return mp4BoxHeader{typ: typ, toEOF: true}, nil
	}
	if size == 1 {
		var extended [8]byte
		if _, err := io.ReadFull(reader, extended[:]); err != nil {
			return mp4BoxHeader{}, err
		}
		size = binary.BigEndian.Uint64(extended[:])
		headerSize = 16
	}
	if size < headerSize {
		return mp4BoxHeader{}, errors.New("MP4 box is smaller than its header")
	}
	return mp4BoxHeader{payloadSize: size - headerSize, typ: typ}, nil
}

func discardMP4Box(reader io.Reader, header mp4BoxHeader) error {
	if header.toEOF {
		_, err := io.Copy(io.Discard, reader)
		return err
	}
	if header.payloadSize > math.MaxInt64 {
		return errors.New("MP4 box is too large")
	}
	_, err := io.CopyN(io.Discard, reader, int64(header.payloadSize))
	return err
}

func parseMovieHeaderCreationTime(reader io.Reader) (time.Time, bool, error) {
	var versionAndFlags [4]byte
	if _, err := io.ReadFull(reader, versionAndFlags[:]); err != nil {
		return time.Time{}, false, err
	}
	var seconds uint64
	switch versionAndFlags[0] {
	case 0:
		var encoded [4]byte
		if _, err := io.ReadFull(reader, encoded[:]); err != nil {
			return time.Time{}, false, err
		}
		seconds = uint64(binary.BigEndian.Uint32(encoded[:]))
	case 1:
		var encoded [8]byte
		if _, err := io.ReadFull(reader, encoded[:]); err != nil {
			return time.Time{}, false, err
		}
		seconds = binary.BigEndian.Uint64(encoded[:])
	default:
		return time.Time{}, false, nil
	}
	if seconds <= uint64(quickTimeUnixEpochOffset) || seconds > math.MaxInt64 {
		return time.Time{}, false, nil
	}
	return time.Unix(int64(seconds)-quickTimeUnixEpochOffset, 0).UTC(), true, nil
}

func findMovieHeaderCreationTime(reader io.Reader) (time.Time, bool, error) {
	for {
		header, err := readMP4BoxHeader(reader)
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return time.Time{}, false, nil
		}
		if err != nil {
			return time.Time{}, false, err
		}
		if string(header.typ[:]) == "mvhd" {
			if header.toEOF {
				return parseMovieHeaderCreationTime(reader)
			}
			if header.payloadSize > math.MaxInt64 {
				return time.Time{}, false, errors.New("MP4 movie header is too large")
			}
			return parseMovieHeaderCreationTime(io.LimitReader(reader, int64(header.payloadSize)))
		}
		if err := discardMP4Box(reader, header); err != nil {
			return time.Time{}, false, err
		}
		if header.toEOF {
			return time.Time{}, false, nil
		}
	}
}

func quickTimeCreationTime(reader io.Reader) (time.Time, bool, error) {
	for {
		header, err := readMP4BoxHeader(reader)
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return time.Time{}, false, nil
		}
		if err != nil {
			return time.Time{}, false, err
		}
		if string(header.typ[:]) == "moov" {
			if header.toEOF {
				return findMovieHeaderCreationTime(reader)
			}
			if header.payloadSize > math.MaxInt64 {
				return time.Time{}, false, errors.New("MP4 movie box is too large")
			}
			return findMovieHeaderCreationTime(io.LimitReader(reader, int64(header.payloadSize)))
		}
		if err := discardMP4Box(reader, header); err != nil {
			return time.Time{}, false, err
		}
		if header.toEOF {
			return time.Time{}, false, nil
		}
	}
}

type quickTimeCreationTimeResult struct {
	recordedAt time.Time
	ok         bool
}

func observeQuickTimeCreationTime(source io.Reader) (io.Reader, func() (time.Time, bool)) {
	metadataReader, metadataWriter := io.Pipe()
	done := make(chan quickTimeCreationTimeResult, 1)
	go func() {
		recordedAt, ok, err := quickTimeCreationTime(metadataReader)
		// Keep consuming after finding metadata so the TeeReader remains
		// streaming and never needs to retain the rest of the audio.
		_, _ = io.Copy(io.Discard, metadataReader)
		_ = metadataReader.Close()
		done <- quickTimeCreationTimeResult{recordedAt: recordedAt, ok: ok && err == nil}
	}()
	return io.TeeReader(source, metadataWriter), func() (time.Time, bool) {
		_ = metadataWriter.Close()
		result := <-done
		return result.recordedAt, result.ok
	}
}
