package ioutil

import "io"

// A value that may be asked to write to something over and over
// until exhausted.
type ChunkedWriterTo interface {
	io.WriterTo
	Done() bool
}
