package ioutil

import (
	"encoding/json"
	"io"
)

var _ ChunkedWriterTo = &JSONWriterTo{}

// an io.WriterTo that writes JSON.
type JSONWriterTo struct {
	V    any
	done bool
}

func (j *JSONWriterTo) WriteTo(w io.Writer) (n int64, err error) {
	ctr := CountingWriter{
		Writer: w,
	}

	err = json.NewEncoder(&ctr).Encode(j.V)

	j.done = true

	return ctr.Count, err
}

func (JSONWriterTo) Close() error { return nil }
func (j JSONWriterTo) Done() bool { return j.done }

type JSONReader struct {
	V any
	io.Reader
}

func (j *JSONReader) Read(b []byte) (n int, err error) {
	if j.Reader == nil {
		j.Reader = &WriterToReader{
			WriterTo: &JSONWriterTo{
				V: j.V,
			},
		}
	}

	return j.Reader.Read(b)
}

func (j *JSONReader) Close() error { return nil }
