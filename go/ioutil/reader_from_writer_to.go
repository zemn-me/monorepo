package ioutil

import (
	"bytes"
	"io"
)

type WriterToCloser interface {
	io.Closer
	ChunkedWriterTo
}

type WriterToReader struct {
	WriterTo WriterToCloser
	buf      bytes.Buffer
}

func (w *WriterToReader) Read(b []byte) (n int, err error) {
	for w.buf.Len() < len(b) && !w.WriterTo.Done() {
		_, err = w.WriterTo.WriteTo(&w.buf)
		if err != nil {
			return
		}
	}

	return w.buf.Read(b)
}

func (w *WriterToReader) Close() (err error) {
	return w.WriterTo.Close()
}
