package jsonc

import (
	"bufio"
	"encoding/json"
	"io"
)

// impl is incorrect because does not care about quotes

type commentStripper struct {
	br          *bufio.Reader
	insideQuote bool
}

var _ io.Reader = &commentStripper{}

func (c *commentStripper) stripLineComment() (err error) {
	_, _, err = c.br.ReadLine()

	return
}

func (c *commentStripper) stripBlockComment() (err error) {
	// continue to pull off bytes delimited by *
	// until a segment is followed by a '/'.
	for {
		if _, err = c.br.ReadBytes('*'); err != nil {
			return
		}

		var nextBt []byte

		if nextBt, err = c.br.Peek(1); err != nil {
			return
		}

		if nextBt[0] == '/' { // */
			if _, err = c.br.ReadByte(); err != nil {
				return
			}

			return
		}
	}
}

func (c *commentStripper) readByteInQuote() (b byte, err error) {
	if b, err = c.br.ReadByte(); err != nil {
		return
	}

	if b == '"' {
		c.insideQuote = false
	}
	return
}

func (c *commentStripper) readByteOutsideQuote() (b byte, err error) {
	if b, err = c.br.ReadByte(); err != nil {
		return
	}

	if b == '"' {
		c.insideQuote = true
		return
	}

	if b != '/' {
		return
	}

	var nextBt []byte

	if nextBt, err = c.br.Peek(1); err != nil {
		return
	}

	switch nextBt[0] {

	case '/': // line comment
		// consume up until end of comment
		if err = c.stripLineComment(); err != nil {
			return
		}

	case '*': // block comment
		if err = c.stripBlockComment(); err != nil {
			return
		}
	}

	return c.br.ReadByte()
}

func (c *commentStripper) ReadByte() (b byte, err error) {
	if c.insideQuote {
		return c.readByteInQuote()
	}

	return c.readByteOutsideQuote()
}

func (c *commentStripper) Read(b []byte) (n int, err error) {
	for i := range b {
		n = i + 1
		if b[i], err = c.ReadByte(); err != nil {
			n--
			return
		}
	}

	return
}

func newCommentStripper(r io.Reader) *commentStripper {
	return &commentStripper{
		br: bufio.NewReader(r),
	}
}

type Decoder struct {
	*json.Decoder
}

func NewDecoder(r io.Reader) Decoder {
	return Decoder{Decoder: json.NewDecoder(newCommentStripper(r))}
}
