package apiserver

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

const (
	journalTranscriptionFileBytes = 24_000_000
	journalPCMSampleRate          = 16_000
	journalPCMBytesPerSecond      = journalPCMSampleRate * 2
	journalPCMChunkBytes          = 10 * 60 * journalPCMBytesPerSecond
)

// Small uploads retain their original format. Large containers must be decoded,
// not sliced at byte offsets: later MediaRecorder fragments lack container headers.
func (o *openAIJournalAI) Transcribe(ctx context.Context, audio io.Reader, contentType string) (JournalTranscriptionResult, error) {
	return o.TranscribeWithProgress(ctx, audio, contentType, func(int, int) error { return nil })
}

// The callback is serialized, including when chunks finish out of order.
func (o *openAIJournalAI) TranscribeWithProgress(ctx context.Context, audio io.Reader, contentType string, report func(completed, total int) error) (JournalTranscriptionResult, error) {

	prefix, err := io.ReadAll(io.LimitReader(audio, journalTranscriptionFileBytes+1))
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	if len(prefix) <= journalTranscriptionFileBytes {
		result, err := o.transcribeFile(ctx, bytes.NewReader(prefix), contentType, false)
		if err == nil {
			err = report(1, 1)
		}
		return result, err
	}
	// A seekable source also handles imported MP4 files with metadata at the end.
	source, err := os.CreateTemp("", "journal-transcription-*")
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	defer os.Remove(source.Name())
	defer source.Close()
	length, err := io.Copy(source, io.LimitReader(io.MultiReader(bytes.NewReader(prefix), audio), maxJournalAudioBytes+1))
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	if length > maxJournalAudioBytes {
		return JournalTranscriptionResult{}, errors.New("journal audio exceeds 256 MiB")
	}
	if err := source.Close(); err != nil {
		return JournalTranscriptionResult{}, err
	}
	return o.transcribeLargeFileWithProgress(ctx, source.Name(), report)
}

type journalChunkTranscript struct {
	startBytes int64
	length     int
	transcript JournalTranscriptionResult
}

func (o *openAIJournalAI) transcribeLargeFile(ctx context.Context, source string) (JournalTranscriptionResult, error) {
	return o.transcribeLargeFileWithProgress(ctx, source, func(int, int) error { return nil })
}

func (o *openAIJournalAI) transcribeLargeFileWithProgress(ctx context.Context, source string, report func(completed, total int) error) (JournalTranscriptionResult, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	executable := o.ffmpegPath
	if executable == "" {
		executable = "ffmpeg"
	}
	// The worker processes uploaded media only. Disable network protocols and
	// playlist/concat demuxers so containers cannot fetch other resources.
	command := exec.CommandContext(ctx, executable,
		"-nostdin", "-hide_banner", "-loglevel", "error", "-xerror",
		"-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm,ogg,wav,mp3,aac",
		"-i", source, "-map", "0:a:0", "-vn", "-threads", "1",
		"-af", "aresample=async=1:first_pts=0",
		"-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1")
	var diagnostic limitedJournalDiagnostic
	command.Stderr = &diagnostic
	pcm, err := command.StdoutPipe()
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	if err := command.Start(); err != nil {
		return JournalTranscriptionResult{}, fmt.Errorf("start journal audio decoder: %w", err)
	}

	requests, requestContext := errgroup.WithContext(ctx)
	requests.SetLimit(3)
	var progressMu sync.Mutex
	completed, total := 0, 0
	var chunks []*journalChunkTranscript
	var offset int64
	var carry []byte
	var readError error
	for ctx.Err() == nil {
		data := make([]byte, journalPCMChunkBytes)
		copied := copy(data, carry)
		n, err := io.ReadFull(pcm, data[copied:])
		n += copied
		if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
			readError = err
			cancel()
			break
		}
		if n%2 != 0 {
			readError = errors.New("audio decoder returned an incomplete PCM sample")
			cancel()
			break
		}
		if n == 0 {
			break
		}
		cut := n
		if err == nil {
			cut = journalSilenceCut(data[:n])
		}
		carry = append([]byte(nil), data[cut:n]...)
		chunk := &journalChunkTranscript{startBytes: offset, length: cut}
		offset += int64(cut)
		chunks = append(chunks, chunk)
		requests.Go(func() error {
			transcript, err := o.transcribeFile(requestContext, journalWAV(data[:cut]), "audio/wav", true)
			if err != nil {
				cancel()
				return fmt.Errorf("transcribe journal chunk at %d ms: %w", chunk.startBytes*1000/journalPCMBytesPerSecond, err)
			}
			chunk.transcript = transcript
			progressMu.Lock()
			defer progressMu.Unlock()
			completed++
			if err := report(completed, total); err != nil {
				cancel()
				return err
			}
			return nil
		})
		if err != nil {
			break
		}
	}
	// Until EOF, decoding may discover more chunks; do not invent a denominator.
	progressMu.Lock()
	total = len(chunks)
	if readError == nil && ctx.Err() == nil {
		if err := report(completed, total); err != nil {
			readError = err
			cancel()
		}
	}
	progressMu.Unlock()
	requestError := requests.Wait()
	processError := command.Wait()
	if requestError != nil {
		return JournalTranscriptionResult{}, requestError
	}
	if readError != nil {
		return JournalTranscriptionResult{}, readError
	}
	if processError != nil {
		return JournalTranscriptionResult{}, fmt.Errorf("decode journal audio: %w: %s", processError, strings.TrimSpace(diagnostic.String()))
	}
	if err := ctx.Err(); err != nil {
		return JournalTranscriptionResult{}, err
	}

	result := JournalTranscriptionResult{DurationMs: offset * 1000 / journalPCMBytesPerSecond}
	for _, chunk := range chunks {
		start := chunk.startBytes * 1000 / journalPCMBytesPerSecond
		end := (chunk.startBytes + int64(chunk.length)) * 1000 / journalPCMBytesPerSecond
		for _, segment := range chunk.transcript.Segments {
			// Align to decoded samples, not the model's rounded duration. That avoids
			// cumulative drift and gives every citation a unique ID in the full note.
			segment.StartMs = max(start, min(end, start+segment.StartMs))
			segment.EndMs = max(segment.StartMs, min(end, start+segment.EndMs))
			segment.Id = fmt.Sprintf("s%d", len(result.Segments))
			result.Segments = append(result.Segments, segment)
		}
	}
	if len(result.Segments) == 0 {
		return JournalTranscriptionResult{}, errors.New("OpenAI returned an empty transcript")
	}
	return result, nil
}

// Prefer a quiet 200 ms window near the end of each piece. All samples after
// the cut are carried into the next piece, including when no silence is found.
func journalSilenceCut(pcm []byte) int {
	const quietBytes = journalPCMBytesPerSecond / 5
	const searchBytes = 15 * journalPCMBytesPerSecond
	for end := len(pcm); end >= max(quietBytes, len(pcm)-searchBytes); end -= quietBytes {
		var energy int64
		for i := end - quietBytes; i < end; i += 2 {
			sample := int64(int16(binary.LittleEndian.Uint16(pcm[i : i+2])))
			energy += sample * sample
		}
		if energy/(quietBytes/2) < 256*256 {
			return end
		}
	}
	return len(pcm)
}

func journalWAV(pcm []byte) io.Reader {
	var header [44]byte
	copy(header[0:], "RIFF")
	binary.LittleEndian.PutUint32(header[4:], uint32(len(pcm)+36))
	copy(header[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(header[16:], 16)
	binary.LittleEndian.PutUint16(header[20:], 1)
	binary.LittleEndian.PutUint16(header[22:], 1)
	binary.LittleEndian.PutUint32(header[24:], journalPCMSampleRate)
	binary.LittleEndian.PutUint32(header[28:], journalPCMBytesPerSecond)
	binary.LittleEndian.PutUint16(header[32:], 2)
	binary.LittleEndian.PutUint16(header[34:], 16)
	copy(header[36:], "data")
	binary.LittleEndian.PutUint32(header[40:], uint32(len(pcm)))
	return io.MultiReader(bytes.NewReader(header[:]), bytes.NewReader(pcm))
}

type limitedJournalDiagnostic struct{ bytes.Buffer }

func (b *limitedJournalDiagnostic) Write(data []byte) (int, error) {
	n := len(data)
	if remaining := 4096 - b.Len(); remaining > 0 {
		_, _ = b.Buffer.Write(data[:min(n, remaining)])
	}
	return n, nil
}
