package ioutil

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"
)

// Mock implementation of WriterToCloser for testing
type mockWriterToCloser struct {
	data  string
	done  bool
	index int
}

func (m *mockWriterToCloser) WriteTo(w io.Writer) (n int64, err error) {
	if m.done {
		return 0, errors.New("write after done")
	}
	if m.index >= len(m.data) {
		m.done = true
		return 0, io.EOF
	}
	// Write one character at a time to simulate streaming
	nn, err := w.Write([]byte{m.data[m.index]})
	m.index += nn
	return int64(nn), err
}

func (m *mockWriterToCloser) Close() error {
	return nil
}

func (m *mockWriterToCloser) Done() bool {
	return m.done
}

// Test for WriterToReader with 2-second timeout
func TestWriterToReader_Read(t *testing.T) {
	data := "Hello, World!"
	mockWriter := &mockWriterToCloser{data: data}

	wtr := &WriterToReader{WriterTo: mockWriter}

	// Read the data in chunks with timeout
	buffer := make([]byte, 5)
	var result bytes.Buffer

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			n, err := wtr.Read(buffer)
			if err != nil && err != io.EOF {
				t.Fatalf("unexpected error during read: %v", err)
			}
			result.Write(buffer[:n])
			if err == io.EOF {
				break
			}
		}
	}()

	select {
	case <-done:
		// Test finished within the timeout
	case <-ctx.Done():
		t.Fatalf("test timed out")
	}

	if result.String() != data {
		t.Fatalf("expected %s, got %s", data, result.String())
	}
}

// Test for WriterToReader_Close with 2-second timeout
func TestWriterToReader_Close(t *testing.T) {
	mockWriter := &mockWriterToCloser{}

	wtr := &WriterToReader{WriterTo: mockWriter}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	done := make(chan struct{})

	go func() {
		defer close(done)
		err := wtr.Close()
		if err != nil {
			t.Fatalf("expected no error on close, got: %v", err)
		}
	}()

	select {
	case <-done:
		// Test finished within the timeout
	case <-ctx.Done():
		t.Fatalf("test timed out")
	}
}

// Additional test to verify Done behaviour with 2-second timeout
func TestWriterToReader_Done(t *testing.T) {
	data := "Short"
	mockWriter := &mockWriterToCloser{data: data}

	wtr := &WriterToReader{WriterTo: mockWriter}

	// Read the data in one go with timeout
	buffer := make([]byte, len(data))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	done := make(chan struct{})

	go func() {
		defer close(done)
		n, err := wtr.Read(buffer)
		if err != nil && err != io.EOF {
			t.Fatalf("unexpected error during read: %v", err)
		}

		if string(buffer[:n]) != data {
			t.Fatalf("expected %s, got %s", data, string(buffer[:n]))
		}

		if !mockWriter.Done() {
			t.Fatalf("expected writer to be done, but it wasn't")
		}
	}()

	select {
	case <-done:
		// Test finished within the timeout
	case <-ctx.Done():
		t.Fatalf("test timed out")
	}
}
