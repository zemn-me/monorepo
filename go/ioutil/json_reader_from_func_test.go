package ioutil

import (
	"bytes"
	"io"
	"testing"
)

func TestJSONReaderFrom(t *testing.T) {
	var b bytes.Buffer

	const str = "Hi!"

	const expected = `"` + str + `"` + "\n"

	_, err := io.Copy(
		&b, &JSONReader{V: str},
	)
	if err != nil {
		t.Fatalf("Copy: %s", err)
	}

	if b.String() != expected {
		t.Fatalf("%+q != %+q", b.String(), expected)
	}
}
