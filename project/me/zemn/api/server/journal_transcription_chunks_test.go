package apiserver

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

func journalTestFFmpeg(t *testing.T) string {
	t.Helper()
	path, err := runfiles.Rlocation(os.Getenv("FFMPEG_RLOCATIONPATH"))
	if err != nil {
		t.Fatal(err)
	}
	return path
}

func journalMultipartAudio(request *http.Request) ([]byte, error) {
	_, parameters, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil {
		return nil, err
	}
	reader := multipart.NewReader(request.Body, parameters["boundary"])
	var audio []byte
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			return audio, nil
		}
		if err != nil {
			return nil, err
		}
		if part.FormName() == "file" {
			audio, err = io.ReadAll(io.LimitReader(part, 25_000_001))
		} else {
			_, err = io.Copy(io.Discard, part)
		}
		if err != nil {
			return nil, err
		}
	}
}

func journalTranscriptionResponse(duration float64, text string) *http.Response {
	return &http.Response{StatusCode: 200, Status: "200 OK", Header: make(http.Header), Body: io.NopCloser(strings.NewReader(fmt.Sprintf(
		`{"duration":%f,"segments":[{"id":0,"start":0,"end":%f,"text":%q}]}`, duration, duration, text,
	)))}
}

type chunkedJournalTestAI struct {
	fakeJournalAI
	transcriber *openAIJournalAI
	progress    func(int, int) error
}

func (ai chunkedJournalTestAI) Transcribe(ctx context.Context, audio io.Reader, contentType string) (JournalTranscriptionResult, error) {
	return ai.transcriber.Transcribe(ctx, audio, contentType)
}

func (ai chunkedJournalTestAI) TranscribeWithProgress(ctx context.Context, audio io.Reader, contentType string, report func(int, int) error) (JournalTranscriptionResult, error) {
	return ai.transcriber.TranscribeWithProgress(ctx, audio, contentType, func(completed, total int) error {
		if err := report(completed, total); err != nil {
			return err
		}
		if ai.progress != nil {
			return ai.progress(completed, total)
		}
		return nil
	})
}

// Exercise the actual decoder and multipart requests through the upload worker:
// one long upload must become one entry whose citations seek in the original file.
func TestLongJournalUploadSplitsAndJoinsOneEntry(t *testing.T) {
	const seconds = 31*60 + 7
	pcm := make([]byte, seconds*journalPCMBytesPerSecond)
	for i := 0; i < len(pcm); i += 2 {
		// Each second is distinguishable, and louder than the silence threshold.
		binary.LittleEndian.PutUint16(pcm[i:], uint16(1000+i/journalPCMBytesPerSecond))
	}
	// A quiet interval just before a ten-minute boundary exercises carry-over.
	clear(pcm[(600-2)*journalPCMBytesPerSecond : (600-1)*journalPCMBytesPerSecond])
	original, err := io.ReadAll(journalWAV(pcm))
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	received := map[int][]byte{}
	ai := &openAIJournalAI{apiKey: "test", ffmpegPath: journalTestFFmpeg(t)}
	ai.client = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, err := journalMultipartAudio(request)
		if err != nil {
			return nil, err
		}
		if len(body) < 46 || len(body) > journalTranscriptionFileBytes || string(body[:4]) != "RIFF" || string(body[8:12]) != "WAVE" {
			return nil, fmt.Errorf("invalid transcription piece: %d bytes", len(body))
		}
		if int(binary.LittleEndian.Uint32(body[40:44])) != len(body)-44 {
			return nil, errors.New("WAV length does not describe the complete piece")
		}
		audio := body[44:]
		start := int(binary.LittleEndian.Uint16(audio[:2])) - 1000
		mu.Lock()
		received[start] = append([]byte(nil), audio...)
		mu.Unlock()
		if start == 0 {
			time.Sleep(40 * time.Millisecond)
		} // completion order must not become transcript order
		duration := float64(len(audio)) / journalPCMBytesPerSecond
		return journalTranscriptionResponse(duration+0.123, fmt.Sprintf("piece at %d", start)), nil
	})}
	objects := &fakeJournalObjects{}
	server := &Server{ddb: &inMemoryDDB{}, journalTableName: "journal", journalBucketName: "journal-audio", journalObjects: objects, journalPresigner: fakeJournalPresigner{}, journalAI: chunkedJournalTestAI{transcriber: ai}}
	ctx := context.WithValue(t.Context(), auth.IDTokenKey, &auth.IDToken{Issuer: "https://api.zemn.me", Subject: journalOwnerSubject})
	response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{Body: &JournalEntryCreate{ContentType: "audio/wav", RecordedAt: time.Now().UTC(), TimeZone: "UTC"}})
	if err != nil {
		t.Fatal(err)
	}
	created, ok := response.(PostJournalEntries201JSONResponse)
	if !ok {
		t.Fatalf("create: %#v", response)
	}
	id := created.Entry.Id.String()
	var observed [][2]int
	server.journalAI = chunkedJournalTestAI{transcriber: ai, progress: func(completed, total int) error {
		response, err := server.GetJournal(ctx, GetJournalRequestObject{})
		if err != nil {
			return err
		}
		entries := response.(GetJournal200JSONResponse).Entries
		if len(entries) != 1 || entries[0].ProcessingProgress == nil {
			return errors.New("progress not exposed by journal API")
		}
		progress := entries[0].ProcessingProgress
		if progress.CompletedChunks != completed || progress.TotalChunks != total || progress.Stage != JournalProcessingProgressStageTranscribing {
			return fmt.Errorf("unexpected progress: %+v", progress)
		}
		observed = append(observed, [2]int{completed, total})
		return nil
	}}
	objects.objects[journalEntryKey(id)] = original
	if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(id), int64(len(original))); err != nil {
		t.Fatal(err)
	}
	result, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := result.(GetJournal200JSONResponse)
	if len(journal.Entries) != 1 {
		t.Fatalf("got %d entries", len(journal.Entries))
	}
	entry := journal.Entries[0]
	if len(observed) < 4 || observed[len(observed)-1] != [2]int{4, 4} {
		t.Fatalf("missing chunk progress: %v", observed)
	}
	for i := 1; i < len(observed); i++ {
		if observed[i][0] < observed[i-1][0] {
			t.Fatalf("progress moved backwards: %v", observed)
		}
	}
	if entry.ProcessingProgress != nil {
		t.Fatal("ready entry retained processing progress")
	}

	if entry.Status != "ready" || entry.DurationMs != seconds*1000 || len(entry.Transcript) != 4 || entry.Summary == nil || entry.AudioUrl == nil {
		t.Fatalf("entry did not retain its audio and complete transcript: %#v", entry)
	}
	var joined []byte
	for i, segment := range entry.Transcript {
		start := len(joined) / journalPCMBytesPerSecond
		audio := received[start]
		if len(audio) == 0 {
			t.Fatalf("missing audio at %d seconds", start)
		}
		if segment.Id != fmt.Sprintf("s%d", i) || segment.StartMs != int64(len(joined))*1000/journalPCMBytesPerSecond {
			t.Fatalf("segment %d has incorrect identity/offset: %#v", i, segment)
		}
		joined = append(joined, audio...)
		if segment.EndMs != int64(len(joined))*1000/journalPCMBytesPerSecond {
			t.Fatalf("segment end drifted: %#v", segment)
		}
	}
	if !bytes.Equal(joined, pcm) {
		t.Fatal("split audio dropped, duplicated, or changed samples")
	}
	if !bytes.Equal(objects.objects[journalEntryKey(id)], original) {
		t.Fatal("original playback file changed")
	}
}

func TestLargeJournalTranscriptionFailureReturnsNoPartialTranscript(t *testing.T) {
	pcm := make([]byte, journalPCMBytesPerSecond*13*60)
	input := journalWAV(pcm)
	ai := &openAIJournalAI{apiKey: "test", ffmpegPath: journalTestFFmpeg(t), client: &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if _, err := journalMultipartAudio(request); err != nil {
			return nil, err
		}
		return &http.Response{StatusCode: 503, Status: "503 Service Unavailable", Body: io.NopCloser(strings.NewReader("try again")), Header: make(http.Header)}, nil
	})}}
	result, err := ai.Transcribe(t.Context(), input, "audio/wav")
	if err == nil || len(result.Segments) != 0 {
		t.Fatalf("failure returned partial success: %#v, %v", result, err)
	}
}

func TestLargeJournalTranscriptionRejectsInvalidContainer(t *testing.T) {
	ai := &openAIJournalAI{ffmpegPath: journalTestFFmpeg(t), client: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("invalid media must not reach transcription")
	})}}
	_, err := ai.Transcribe(t.Context(), io.LimitReader(repeatingJournalByte('x'), journalTranscriptionFileBytes+1), "audio/webm")
	if err == nil || !strings.Contains(err.Error(), "decode journal audio") {
		t.Fatalf("invalid container: %v", err)
	}
}

type repeatingJournalByte byte

func (b repeatingJournalByte) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = byte(b)
	}
	return len(p), nil
}

func TestJournalSplittingPreservesGapsInThePlaybackTimeline(t *testing.T) {
	executable := journalTestFFmpeg(t)
	source := filepath.Join(t.TempDir(), "pause.mka")
	// Simulate a recorder that resumes with a gap in packet timestamps.
	command := exec.CommandContext(t.Context(), executable, "-nostdin", "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", "aevalsrc=0.1:s=16000:d=1", "-af", "asetpts='PTS+2/TB*gte(T,0.5)'", "-c:a", "pcm_s16le", source)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("create paused recording: %v: %s", err, output)
	}
	ai := &openAIJournalAI{apiKey: "test", ffmpegPath: executable, client: &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		audio, err := journalMultipartAudio(request)
		if err != nil {
			return nil, err
		}
		if len(audio) < 44+2*journalPCMBytesPerSecond {
			return nil, errors.New("decoder removed the playback gap")
		}
		for _, sample := range audio[44+journalPCMBytesPerSecond : 44+2*journalPCMBytesPerSecond] {
			if sample != 0 {
				return nil, errors.New("playback gap was not represented as silence")
			}
		}
		return journalTranscriptionResponse(3, "Resumed after a pause."), nil
	})}}
	result, err := ai.transcribeLargeFile(t.Context(), source)
	if err != nil {
		t.Fatal(err)
	}
	if result.DurationMs < 2999 || result.DurationMs > 3001 {
		t.Fatalf("recording timeline shortened: %d ms", result.DurationMs)
	}
}
