package ioutil

import (
	"bytes"
	"fmt"
	"io"
	"testing"
)

// MockWriterToCloser implements the WriterToCloser interface
type MockWriterToCloser struct {
	data   []byte
	done   bool
	offset int
}

func (m *MockWriterToCloser) WriteTo(w io.Writer) (n int64, err error) {
	if m.offset >= len(m.data) {
		return 0, fmt.Errorf("Exhausted: %v", io.EOF)
	}

	// Write chunk of data
	nBytes, err := w.Write(m.data[m.offset:])
	m.offset += nBytes
	n = int64(nBytes)

	if m.offset >= len(m.data) {
		m.done = true
	}
	return n, err
}

func (m *MockWriterToCloser) Done() bool {
	return m.done
}

func (m *MockWriterToCloser) Close() error {
	m.done = true
	return nil
}

// Test reading a chunk of data
func TestWriterToReader_ReadChunk(t *testing.T) {
	// Create a buffer with some test data
	testData := []byte("hello, world")
	writer := &MockWriterToCloser{
		data: testData,
		done: false,
	}

	reader := &WriterToReader{
		WriterTo: writer,
	}

	// Buffer to read into
	buf := make([]byte, 5)

	// Test reading the first chunk
	n, err := reader.Read(buf)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if n != 5 || !bytes.Equal(buf, testData[:5]) {
		t.Fatalf("expected to read %q, got %q", testData[:5], buf)
	}
}

// Test reading the remaining data
func TestWriterToReader_ReadRemaining(t *testing.T) {
	// Create a buffer with some test data
	testData := []byte("hello, world")
	writer := &MockWriterToCloser{
		data: testData,
		done: false,
	}

	reader := &WriterToReader{
		WriterTo: writer,
	}

	// Read first 5 bytes
	buf := make([]byte, 5)
	_, err := reader.Read(buf)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Test reading the remaining chunk of data
	n, err := reader.Read(buf)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if n != 5 || !bytes.Equal(buf[:5], testData[5:10]) {
		t.Fatalf("expected to read %q, got %q", testData[5:10], buf[:5])
	}
}

// Test reading until EOF
func TestWriterToReader_ReadUntilEOF(t *testing.T) {
	// Create a buffer with some test data
	testData := []byte("hello, world")
	writer := &MockWriterToCloser{
		data: testData,
		done: false,
	}

	reader := &WriterToReader{
		WriterTo: writer,
	}

	// Buffer to read into
	buf := make([]byte, len(testData))

	// Read all data
	_, _ = reader.Read(buf)

	t.Logf("Read all data read %+q", buf)

	// Test reading EOF
	n, err := reader.Read(buf)
	if err != io.EOF {
		t.Fatalf("expected io.EOF, got %v", err)
	}
	if n != 0 {
		t.Fatalf("expected to read 0 bytes at EOF, got %d", n)
	}
}

// Test that Close is called properly
func TestWriterToReader_Close(t *testing.T) {
	writer := &MockWriterToCloser{
		data: []byte("some data"),
		done: false,
	}

	reader := &WriterToReader{
		WriterTo: writer,
	}

	err := reader.Close()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if !writer.done {
		t.Fatalf("expected writer to be done, but it wasn't")
	}
}
