package main

import (
	"encoding/binary"
	"errors"
	"io"

	"github.com/mewkiz/flac"
	"github.com/mewkiz/flac/frame"

	"github.com/zemn-me/monorepo/go/ioutil"
)

type PCMWriterTo struct {
	*flac.Stream
	done bool
}

func (p *PCMWriterTo) WriteTo(w io.Writer) (n int64, err error) {
	var f *frame.Frame
	f, err = p.ParseNext()
	if err != nil {
		if err != io.EOF {
			return
		}
		p.done = true
	}

	for _, subframe := range f.Subframes {
		for _, sample := range subframe.Samples {
			sampleBytes := make([]byte, 2, 2)
			binary.LittleEndian.PutUint16(sampleBytes, uint16(sample))
			var delta int
			delta, err = w.Write(sampleBytes)
			n += int64(delta)
			if err != nil {
				return
			}
		}
	}

	return
}

func (p *PCMWriterTo) Done() bool {
	return p.done
}

// returns an io.ReadCloser of PCM bytes
func pcmBytesFromFLACFile(path string) (rd io.ReadCloser, err error) {
	stream, err := flac.ParseFile(path)
	if err != nil {
		return nil, errors.Join(err, stream.Close())
	}

	rd = &ioutil.WriterToReader{
		WriterTo: &PCMWriterTo{Stream: stream},
	}

	return
}
