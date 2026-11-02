package main

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

func TestLocalJournalStoreUploadsProcessesAndServesAudio(t *testing.T) {
	store, err := newLocalJournalStore("", log.New(io.Discard, "", 0))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	server := httptest.NewServer(store)
	t.Cleanup(server.Close)
	store.baseURL = server.URL

	type processedUpload struct {
		bucket string
		key    string
		size   int64
	}
	processed := make(chan processedUpload, 1)
	store.SetUploadProcessor(func(_ context.Context, bucket, key string, size int64) error {
		processed <- processedUpload{bucket: bucket, key: key, size: size}
		return nil
	})

	bucket, key, contentType := "journal", "entries/entry/source", "audio/webm"
	presigned, err := store.PresignPutObject(t.Context(), &s3.PutObjectInput{
		Bucket: &bucket, Key: &key, ContentType: &contentType, IfNoneMatch: stringPointer("*"),
	})
	if err != nil {
		t.Fatal(err)
	}
	audio := bytes.Repeat([]byte("fragmented audio"), 4096)
	request, err := http.NewRequest(http.MethodPut, presigned.URL, &smallReads{source: bytes.NewReader(audio)})
	if err != nil {
		t.Fatal(err)
	}
	request.Header = presigned.SignedHeader
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("upload status = %d, want %d", response.StatusCode, http.StatusNoContent)
	}

	select {
	case upload := <-processed:
		if upload.bucket != bucket || upload.key != key || upload.size != int64(len(audio)) {
			t.Fatalf("processed upload = %#v", upload)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("local upload was not processed")
	}

	playback, err := store.PresignGetObject(t.Context(), &s3.GetObjectInput{Bucket: &bucket, Key: &key})
	if err != nil {
		t.Fatal(err)
	}
	response, err = http.Get(playback.URL)
	if err != nil {
		t.Fatal(err)
	}
	played, err := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if response.Header.Get("Content-Type") != contentType || !bytes.Equal(played, audio) {
		t.Fatalf("playback returned content type %q and %d bytes", response.Header.Get("Content-Type"), len(played))
	}

	store.readLifetime = 5 * time.Millisecond
	expiringPlayback, err := store.PresignGetObject(t.Context(), &s3.GetObjectInput{Bucket: &bucket, Key: &key})
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(20 * time.Millisecond)
	expiredResponse, err := http.Get(expiringPlayback.URL)
	if err != nil {
		t.Fatal(err)
	}
	_ = expiredResponse.Body.Close()
	if expiredResponse.StatusCode != http.StatusForbidden {
		t.Fatalf("expired playback status = %d, want %d", expiredResponse.StatusCode, http.StatusForbidden)
	}

	request, err = http.NewRequest(http.MethodPut, presigned.URL, strings.NewReader("replacement"))
	if err != nil {
		t.Fatal(err)
	}
	request.Header = presigned.SignedHeader
	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusPreconditionFailed {
		t.Fatalf("replacement status = %d, want %d", response.StatusCode, http.StatusPreconditionFailed)
	}
}

func TestDevelopmentJournalFixturesProduceDistinctRealisticEntries(t *testing.T) {
	ai := localJournalAI{}
	seenAudio := map[string]struct{}{}
	for index, want := range developmentJournalFixtures {
		audio := developmentJournalWAV(index + 7)
		key := string(audio)
		if _, exists := seenAudio[key]; exists {
			t.Fatalf("fixture %d reused another fixture's audio", index)
		}
		seenAudio[key] = struct{}{}

		fixture := developmentJournalFixtureForByteLength(int64(len(audio)))
		if fixture != &developmentJournalFixtures[index] {
			t.Fatalf("audio %d selected fixture %#v, want %#v", index, fixture, want)
		}
		transcript, err := ai.Transcribe(t.Context(), bytes.NewReader(audio), "audio/wav")
		if err != nil {
			t.Fatalf("transcribe fixture %d: %v", index, err)
		}
		if len(transcript.Segments) != len(want.transcript) || transcript.Segments[0].Text != want.transcript[0] {
			t.Fatalf("fixture %d transcript = %#v", index, transcript.Segments)
		}
		summary, err := ai.Summarize(t.Context(), "entry", []apiserver.JournalSummarySource{{
			Text: transcript.Segments[0].Text,
		}})
		if err != nil {
			t.Fatalf("summarize fixture %d: %v", index, err)
		}
		if summary.Title != want.title || summary.Blocks[0].Markdown != want.summary {
			t.Fatalf("fixture %d summary = %#v", index, summary)
		}
	}
}

type smallReads struct {
	source io.Reader
}

func (r *smallReads) Read(buffer []byte) (int, error) {
	if len(buffer) > 11 {
		buffer = buffer[:11]
	}
	return r.source.Read(buffer)
}

func stringPointer(value string) *string { return &value }
