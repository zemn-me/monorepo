package jsonc

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
)

type chunkReader func() (chunk []byte, next chunkReader, err error)

type commentStripper struct {
	r    bufio.Reader
	next chunkReader
	buf  bytes.Buffer
}

func (q *commentStripper) Read(b []byte) (n int, err error) {
	for q.buf.Len() < len(b) {
		var chunk []byte
		if chunk, err = q.ReadChunk(); err != nil {
			if err == io.EOF {
				break
			}
			return
		}

		if _, err = q.buf.Write(chunk); err != nil {
			return
		}
	}

	n, err = q.buf.Read(b)

	return
}

func (q *commentStripper) ReadChunk() (chunk []byte, err error) {
	if q.next == nil {
		q.next = q.ReadChunkUniverse
	}

	chunk, q.next, err = q.next()

	return
}

func (q *commentStripper) ReadChunkUniverse() (chunk []byte, next chunkReader, err error) {
	var r rune
	r, _, err = q.r.ReadRune()
	if err != nil {
		return
	}

	if r == '/' {
		var r2 rune
		r2, _, err = q.r.ReadRune()
		if err != nil {
			return
		}

		switch r2 {
		case '/': // "//"
			return nil, q.ReadChunkLineComment, nil
		case '*': // "/*"
			return nil, q.ReadChunkBlockComment, nil
		}

		return []byte(string([]rune{r, r2})), q.ReadChunkUniverse, nil
	}

	if r == '"' {
		return []byte(string([]rune{r})), q.ReadChunkInsideQuote, nil
	}

	return []byte(string([]rune{r})), q.ReadChunkUniverse, nil
}

func (q *commentStripper) ReadChunkLineComment() (chunk []byte, next chunkReader, err error) {
	var r rune
	if r, _, err = q.r.ReadRune(); err != nil {
		return
	}

	if r == '\n' {
		return []byte(string([]rune{r})), q.ReadChunkUniverse, nil
	}

	return nil, q.ReadChunkLineComment, nil
}

func (q *commentStripper) ReadChunkBlockComment() (chunk []byte, next chunkReader, err error) {
	var r rune
	if r, _, err = q.r.ReadRune(); err != nil {
		return
	}

	if r == '*' {
		var r2 rune
		if r2, _, err = q.r.ReadRune(); err != nil {
			return
		}

		if r2 == '/' {
			return nil, q.ReadChunkUniverse, nil
		}
	}

	// might seem weird, but we're in a comment so regardless of
	// how much we read we're dropping all bytes.
	return nil, q.ReadChunkBlockComment, nil
}

func (q *commentStripper) ReadChunkInsideQuote() (chunk []byte, next chunkReader, err error) {
	var r rune
	if r, _, err = q.r.ReadRune(); err != nil {
		return
	}

	if r == '\\' { // escaped segment
		return []byte(string([]rune{r})), q.ReadChunkInsideEscapedQuoteSegment, nil
	}

	if r == '"' {
		return []byte(string([]rune{r})), q.ReadChunkUniverse, nil
	}

	return []byte(string([]rune{r})), q.ReadChunkInsideQuote, nil
}

func (q *commentStripper) ReadChunkInsideEscapedQuoteSegment() (chunk []byte, next chunkReader, err error) {
	var r rune
	if r, _, err = q.r.ReadRune(); err != nil {
		return
	}

	if r == '"' {
		return []byte(string([]rune{r})), q.ReadChunkInsideQuote, nil
	}

	return []byte(string([]rune{r})), q.ReadChunkInsideQuote, nil
}

func NewDecoder(r io.Reader) *json.Decoder {
	return json.NewDecoder(&commentStripper{
		r: *bufio.NewReader(r),
	})
}
