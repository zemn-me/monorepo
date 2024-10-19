package ioutil

import (
	"errors"
	"fmt"
	"io"
)

type WriterToCloser interface {
	io.Closer
	ChunkedWriterTo
}

type WriterToReader struct {
	WriterTo WriterToCloser
	rd       *io.PipeReader
	w        *io.PipeWriter
}

func (w *WriterToReader) Read(b []byte) (n int, err error) {
	if w.WriterTo.Done() {
		return 0, io.EOF
	}

	if w.rd == nil || w.w == nil {
		w.rd, w.w = io.Pipe()
	}

	// write to the pipe until the pipe unblocks
	done := make(chan struct{})

	go func(rsp chan struct{}) {
		fmt.Println("Reading...")
		n, err = w.rd.Read(b)
		fmt.Println("Read complete...")
		rsp <- struct{}{}
	}(done)

loop:
	for {
		if w.WriterTo.Done() {
			fmt.Println("Done!")
			// close the pipe so it unblocks
			err = errors.Join(w.w.Close(), w.rd.Close())
			break
		}

		select {
		case <-done:
			fmt.Println("Rcvd done.")
			break loop
		default:
			fmt.Println("Writing...")
			go func() {
				w.WriterTo.WriteTo(w.w)
			}()
		}
	}

	return
}

func (w *WriterToReader) Close() (err error) {
	return errors.Join(w.WriterTo.Close(), w.rd.Close(), w.w.Close())
}
