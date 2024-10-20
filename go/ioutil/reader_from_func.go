package iotuil

import (
	"io"
)

// ReaderFromFunc is a type that allows a function to implement the io.ReaderFrom interface.
type ReaderFromFunc func(r io.Reader) (n int64, err error)

// ReadFrom calls the ReaderFromFunc.
func (f ReaderFromFunc) ReadFrom(r io.Reader) (n int64, err error) {
	return f(r)
}
