package ioutil

import "io"

type CountingWriter struct {
	io.Writer
	Count int64
}

func (c *CountingWriter) Write(b []byte) (n int, err error) {
	n, err = c.Writer.Write(b)
	c.Count += int64(n)

	return
}
