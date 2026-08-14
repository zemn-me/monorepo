package apiserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"mime"
	"mime/multipart"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type fakeJournalObjects struct {
	objects map[string][]byte
}

func (f *fakeJournalObjects) DeleteObject(_ context.Context, input *s3.DeleteObjectInput, _ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	delete(f.objects, *input.Key)
	return &s3.DeleteObjectOutput{}, nil
}

func (f *fakeJournalObjects) PutObject(_ context.Context, input *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if f.objects == nil {
		f.objects = map[string][]byte{}
	}
	body, err := io.ReadAll(input.Body)
	if err != nil {
		return nil, err
	}
	f.objects[*input.Key] = body
	return &s3.PutObjectOutput{}, nil
}

func (f *fakeJournalObjects) GetObject(_ context.Context, input *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	body := f.objects[*input.Key]
	length := int64(len(body))
	return &s3.GetObjectOutput{
		Body: io.NopCloser(strings.NewReader(string(body))), ContentLength: &length,
	}, nil
}

type fakeJournalPresigner struct{}

func (fakeJournalPresigner) PresignPutObject(_ context.Context, input *s3.PutObjectInput, _ ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	return &v4.PresignedHTTPRequest{
		Method: http.MethodPut,
		URL:    "https://upload.invalid/" + *input.Key,
		SignedHeader: http.Header{
			"Content-Type":  []string{*input.ContentType},
			"If-None-Match": []string{*input.IfNoneMatch},
		},
	}, nil
}

func (fakeJournalPresigner) PresignGetObject(_ context.Context, input *s3.GetObjectInput, _ ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	return &v4.PresignedHTTPRequest{Method: http.MethodGet, URL: "https://audio.invalid/" + *input.Key}, nil
}

type fakeJournalAI struct{}

func (fakeJournalAI) Transcribe(_ context.Context, audio io.Reader, _ string) (JournalTranscriptionResult, error) {
	if _, err := io.Copy(io.Discard, audio); err != nil {
		return JournalTranscriptionResult{}, err
	}
	return JournalTranscriptionResult{
		DurationMs: 1750,
		Segments: []JournalTranscriptSegment{{
			Id: "s0", StartMs: 0, EndMs: 1500, Text: "Today I planted rosemary.",
		}},
	}, nil
}

func (ai fakeJournalAI) AnalyzeEntry(ctx context.Context, _ time.Time, _ string, sources []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	summary, err := ai.Summarize(ctx, "entry", sources)
	return JournalEntryAnalysisResult{Summary: summary}, err
}

type inferredDateJournalAI struct {
	fakeJournalAI
	recordedDate string
}

func (ai inferredDateJournalAI) AnalyzeEntry(ctx context.Context, provisionalRecordedAt time.Time, timeZone string, sources []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	analysis, err := ai.fakeJournalAI.AnalyzeEntry(ctx, provisionalRecordedAt, timeZone, sources)
	analysis.RecordedDate = ai.recordedDate
	return analysis, err
}

type recordingJournalAI struct {
	periods []string
}

func (*recordingJournalAI) Transcribe(ctx context.Context, audio io.Reader, contentType string) (JournalTranscriptionResult, error) {
	return (fakeJournalAI{}).Transcribe(ctx, audio, contentType)
}

func (f *recordingJournalAI) AnalyzeEntry(ctx context.Context, provisionalRecordedAt time.Time, timeZone string, sources []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	f.periods = append(f.periods, "entry")
	return (fakeJournalAI{}).AnalyzeEntry(ctx, provisionalRecordedAt, timeZone, sources)
}

func (f *recordingJournalAI) Summarize(ctx context.Context, period string, sources []JournalSummarySource) (JournalSummaryResult, error) {
	f.periods = append(f.periods, period)
	return (fakeJournalAI{}).Summarize(ctx, period, sources)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

type fragmentedReader struct {
	source io.Reader
	reads  int
}

func (r *fragmentedReader) Read(buffer []byte) (int, error) {
	r.reads++
	if len(buffer) > 7 {
		buffer = buffer[:7]
	}
	return r.source.Read(buffer)
}

func testMP4Box(typ string, payload []byte) []byte {
	encoded := make([]byte, 8+len(payload))
	binary.BigEndian.PutUint32(encoded[:4], uint32(len(encoded)))
	copy(encoded[4:8], typ)
	copy(encoded[8:], payload)
	return encoded
}

func testMP4(recordedAt time.Time, version byte) []byte {
	seconds := uint64(recordedAt.Unix() + quickTimeUnixEpochOffset)
	movieHeader := make([]byte, 12)
	movieHeader[0] = version
	if version == 0 {
		binary.BigEndian.PutUint32(movieHeader[4:8], uint32(seconds))
	} else {
		binary.BigEndian.PutUint64(movieHeader[4:12], seconds)
	}
	return bytes.Join([][]byte{
		testMP4Box("ftyp", []byte("M4A ")),
		testMP4Box("mdat", []byte("voice note audio")),
		testMP4Box("moov", bytes.Join([][]byte{
			testMP4Box("free", []byte("padding")),
			testMP4Box("mvhd", movieHeader),
		}, nil)),
	}, nil)
}

func TestObserveQuickTimeCreationTimeStreamsAudio(t *testing.T) {
	recordedAt := time.Date(2024, time.March, 4, 5, 6, 7, 0, time.UTC)
	for _, version := range []byte{0, 1} {
		t.Run(fmt.Sprintf("version-%d", version), func(t *testing.T) {
			audio := testMP4(recordedAt, version)
			observed, finish := observeQuickTimeCreationTime(&fragmentedReader{source: bytes.NewReader(audio)})
			streamed, err := io.ReadAll(observed)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(streamed, audio) {
				t.Fatal("metadata inspection changed the streamed audio")
			}
			got, ok := finish()
			if !ok || !got.Equal(recordedAt) {
				t.Fatalf("creation time = %v, %v; want %v, true", got, ok, recordedAt)
			}
		})
	}
}

type fakeJournalSTS struct {
	input *sts.GetWebIdentityTokenInput
	calls int
}

func (f *fakeJournalSTS) GetWebIdentityToken(_ context.Context, input *sts.GetWebIdentityTokenInput, _ ...func(*sts.Options)) (*sts.GetWebIdentityTokenOutput, error) {
	f.input = input
	f.calls++
	return &sts.GetWebIdentityTokenOutput{WebIdentityToken: aws.String("aws-subject-jwt")}, nil
}

func TestOpenAIWorkloadIdentityExchangesAWSIdentity(t *testing.T) {
	stsClient := &fakeJournalSTS{}
	tokenExchanges := 0
	apiRequests := 0
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		switch request.URL.Host {
		case "auth.openai.com":
			tokenExchanges++
			var payload map[string]string
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				return nil, err
			}
			if payload["subject_token"] != "aws-subject-jwt" ||
				payload["identity_provider_id"] != "provider-id" ||
				payload["service_account_id"] != "service-account-id" {
				return nil, fmt.Errorf("unexpected token exchange payload: %#v", payload)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body:       io.NopCloser(strings.NewReader(`{"access_token":"openai-access-token","token_type":"Bearer","expires_in":3600}`)),
				Header:     make(http.Header),
			}, nil
		case "api.openai.com":
			apiRequests++
			if got := request.Header.Get("Authorization"); got != "Bearer openai-access-token" {
				return nil, fmt.Errorf("Authorization = %q", got)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body:       io.NopCloser(strings.NewReader(`{}`)),
				Header:     make(http.Header),
			}, nil
		default:
			return nil, fmt.Errorf("unexpected request host %q", request.URL.Host)
		}
	})}
	journalAI, err := newOpenAIJournalAIWithWorkloadIdentity("provider-id", "service-account-id", stsClient)
	if err != nil {
		t.Fatal(err)
	}
	ai := journalAI.(*openAIJournalAI)
	ai.client = client
	for range 2 {
		request, err := http.NewRequest(http.MethodGet, "https://api.openai.com/v1/models", nil)
		if err != nil {
			t.Fatal(err)
		}
		response, err := ai.request(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
	}
	if stsClient.calls != 1 || tokenExchanges != 1 || apiRequests != 2 {
		t.Fatalf("calls = STS %d/token exchange %d/API %d, want 1/1/2", stsClient.calls, tokenExchanges, apiRequests)
	}
	if got := stsClient.input.Audience; !slices.Equal(got, []string{openAIWorkloadAudience}) {
		t.Fatalf("STS audience = %v", got)
	}
	if got := aws.ToInt32(stsClient.input.DurationSeconds); got != 300 {
		t.Fatalf("STS duration = %d", got)
	}
	if got := aws.ToString(stsClient.input.SigningAlgorithm); got != "ES384" {
		t.Fatalf("STS signing algorithm = %q", got)
	}
}

func TestOpenAITranscriptionStreamsMultipartAudio(t *testing.T) {
	audio := strings.Repeat("arbitrary audio chunk", 4096)
	expectedHash := sha256.Sum256([]byte(audio))
	fragmented := &fragmentedReader{source: strings.NewReader(audio)}
	var receivedHash [sha256.Size]byte
	var receivedBytes int64
	receivedFields := map[string]string{}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		mediaType, parameters, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if err != nil || mediaType != "multipart/form-data" {
			return nil, fmt.Errorf("invalid multipart content type %q: %w", mediaType, err)
		}
		parts := multipart.NewReader(request.Body, parameters["boundary"])
		for {
			part, err := parts.NextPart()
			if errors.Is(err, io.EOF) {
				break
			}
			if err != nil {
				return nil, err
			}
			if part.FormName() != "file" {
				value, err := io.ReadAll(part)
				if err != nil {
					return nil, err
				}
				receivedFields[part.FormName()] = string(value)
				continue
			}
			hash := sha256.New()
			receivedBytes, err = io.Copy(hash, part)
			if err != nil {
				return nil, err
			}
			copy(receivedHash[:], hash.Sum(nil))
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body: io.NopCloser(strings.NewReader(
				`{"duration":1.25,"segments":[{"id":0,"start":0,"end":1,"text":"streamed"}]}`,
			)),
			Header: make(http.Header),
		}, nil
	})}
	ai := &openAIJournalAI{apiKey: "test", client: client}
	transcription, err := ai.Transcribe(context.Background(), fragmented, "audio/mp4")
	if err != nil {
		t.Fatal(err)
	}
	if receivedBytes != int64(len(audio)) || receivedHash != expectedHash {
		t.Fatalf("received %d bytes with hash %x, want %d bytes with hash %x", receivedBytes, receivedHash, len(audio), expectedHash)
	}
	if fragmented.reads < 2 {
		t.Fatalf("audio source was read only %d time(s), want fragmented streaming reads", fragmented.reads)
	}
	if got := receivedFields["prompt"]; got != journalTranscriptionPrompt {
		t.Fatalf("transcription prompt = %q, want punctuation exemplar %q", got, journalTranscriptionPrompt)
	}
	if transcription.DurationMs != 1250 || len(transcription.Segments) != 1 || transcription.Segments[0].Text != "streamed" {
		t.Fatalf("transcription = %#v", transcription)
	}
}

func TestOpenAISummaryUsesGeneratedRequestAndResponseTypes(t *testing.T) {
	sources := []JournalSummarySource{{
		Label: "entry",
		Text:  "A real transcript segment.",
		Citations: []JournalCitation{{
			EntryId: "entry-1", SegmentId: "s0", Quote: "A real transcript segment.",
		}},
	}}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			return nil, err
		}
		if payload["store"] != false {
			return nil, fmt.Errorf("store = %v, want false", payload["store"])
		}
		if payload["model"] != journalSummaryModel {
			return nil, fmt.Errorf("model = %v, want %q", payload["model"], journalSummaryModel)
		}
		instructions, ok := payload["instructions"].(string)
		if !ok {
			return nil, fmt.Errorf("instructions = %T, want string", payload["instructions"])
		}
		if instructions != journalSummaryInstructions {
			return nil, errors.New("request did not use the journal narrative summary instructions")
		}
		if !strings.Contains(instructions, "[^1]") {
			return nil, fmt.Errorf("instructions do not require inline Markdown citations: %q", instructions)
		}
		if _, ok := payload["input"].(string); !ok {
			return nil, fmt.Errorf("input = %T, want string", payload["input"])
		}
		text, ok := payload["text"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text = %T, want object", payload["text"])
		}
		format, ok := text["format"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text.format = %T, want object", text["format"])
		}
		if format["type"] != "json_schema" || format["strict"] != true {
			return nil, fmt.Errorf("text.format = %#v, want strict JSON schema", format)
		}
		schema, ok := format["schema"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text.format.schema = %T, want object", format["schema"])
		}
		properties, ok := schema["properties"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("schema.properties = %T, want object", schema["properties"])
		}
		for _, property := range []string{"blocks", "title"} {
			if _, ok := properties[property]; !ok {
				return nil, fmt.Errorf("schema is missing generated %q property", property)
			}
		}
		if _, ok := properties["themes"]; ok {
			return nil, errors.New("schema still contains generated themes")
		}
		if schema["additionalProperties"] != false {
			return nil, fmt.Errorf("schema.additionalProperties = %v, want false", schema["additionalProperties"])
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body: io.NopCloser(strings.NewReader(`{
				"instructions": "Summarize a private voice journal.",
				"output": [
					{"type": "reasoning", "id": "reasoning-1", "summary": []},
					{
						"type": "message",
						"id": "message-1",
						"status": "completed",
						"role": "assistant",
						"content": [{
							"type": "output_text",
							"annotations": [],
							"logprobs": [],
							"text": "{\"title\":\"Generated title\",\"blocks\":[{\"markdown\":\"Grounded.[^1]\",\"citations\":[{\"entryId\":\"entry-1\",\"segmentId\":\"s0\",\"quote\":\"A real transcript segment.\"}]}]}"
						}]
					}
				]
			}`)),
			Header: make(http.Header),
		}, nil
	})}
	ai := &openAIJournalAI{apiKey: "test", client: client}
	summary, err := ai.Summarize(context.Background(), "entry", sources)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Title != "Generated title" || len(summary.Blocks) != 1 || len(summary.Blocks[0].Citations) != 1 {
		t.Fatalf("summary = %#v", summary)
	}
}

func TestOpenAIEntryAnalysisInfersExplicitRecordingDate(t *testing.T) {
	sources := []JournalSummarySource{{
		Label: "entry",
		Text:  "It is Thursday the 13th of August. I am recording this before bed.",
		Citations: []JournalCitation{{
			EntryId: "entry-1", SegmentId: "s0", Quote: "It is Thursday the 13th of August.",
		}},
	}}
	provisionalRecordedAt := time.Date(2026, time.August, 14, 23, 25, 0, 0, time.FixedZone("PDT", -7*60*60))
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			return nil, err
		}
		if payload["instructions"] != journalEntryAnalysisInstructions {
			return nil, errors.New("request did not use the journal entry date instructions")
		}
		input, ok := payload["input"].(string)
		if !ok || !strings.Contains(input, provisionalRecordedAt.Format(time.RFC3339)) || !strings.Contains(input, "America/Los_Angeles") {
			return nil, fmt.Errorf("entry analysis input lacks provisional date context: %#v", payload["input"])
		}
		text, ok := payload["text"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text = %T, want object", payload["text"])
		}
		format, ok := text["format"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text.format = %T, want object", text["format"])
		}
		schema, ok := format["schema"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("text.format.schema = %T, want object", format["schema"])
		}
		properties, ok := schema["properties"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("schema.properties = %T, want object", schema["properties"])
		}
		for _, property := range []string{"recordedDate", "summary"} {
			if _, ok := properties[property]; !ok {
				return nil, fmt.Errorf("entry analysis schema is missing %q", property)
			}
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body: io.NopCloser(strings.NewReader(`{
				"output": [{
					"type": "message",
					"id": "message-1",
					"status": "completed",
					"role": "assistant",
					"content": [{
						"type": "output_text",
						"annotations": [],
						"logprobs": [],
						"text": "{\"summary\":{\"title\":\"Thursday reflection\",\"blocks\":[{\"markdown\":\"Recorded before bed.[^1]\",\"citations\":[{\"entryId\":\"entry-1\",\"segmentId\":\"s0\",\"quote\":\"It is Thursday the 13th of August.\"}]}]},\"recordedDate\":\"2026-08-13\"}"
					}]
				}]
			}`)),
			Header: make(http.Header),
		}, nil
	})}
	analysis, err := (&openAIJournalAI{apiKey: "test", client: client}).AnalyzeEntry(
		context.Background(), provisionalRecordedAt, "America/Los_Angeles", sources,
	)
	if err != nil {
		t.Fatal(err)
	}
	if analysis.RecordedDate != "2026-08-13" || analysis.Summary.Title != "Thursday reflection" {
		t.Fatalf("analysis = %#v", analysis)
	}
}

func TestJournalSummaryInstructionsRequireNarrativeSynthesis(t *testing.T) {
	for _, requirement := range []string{
		"story of his life and thinking over time",
		"not a keyword sample or a list of themes",
		"Return a short title",
		"synthesize the development",
		"Preserve uncertainty",
		"Distinguish what Thomas directly said from interpretation",
		`Do not use generic headings or labels such as "Theme"`,
	} {
		if !strings.Contains(journalSummaryInstructions, requirement) {
			t.Errorf("journal summary instructions are missing %q", requirement)
		}
	}
	for _, removed := range []string{
		"short, specific generated title",
		"The title must name a specific subject or movement",
		"Be reflective, not diagnostic",
	} {
		if strings.Contains(journalSummaryInstructions, removed) {
			t.Errorf("journal summary instructions still contain %q", removed)
		}
	}
}

func TestJournalEntryAnalysisInstructionsRequireGroundedRecordingDate(t *testing.T) {
	for _, requirement := range []string{
		"recording itself is being made",
		"explicitly states or unambiguously identifies the recording date",
		"Do not mistake the date of a remembered, planned, or otherwise discussed event",
		"set recordedDate to an empty string",
	} {
		if !strings.Contains(journalEntryAnalysisInstructions, requirement) {
			t.Errorf("journal entry analysis instructions are missing %q", requirement)
		}
	}
}

func (fakeJournalAI) Summarize(_ context.Context, period string, sources []JournalSummarySource) (JournalSummaryResult, error) {
	var citations []JournalCitation
	for _, source := range sources {
		citations = append(citations, source.Citations...)
	}
	var references strings.Builder
	for index := range citations {
		fmt.Fprintf(&references, "[^%d]", index+1)
	}
	return JournalSummaryResult{
		Title: period + " narrative",
		Blocks: []JournalSummaryBlock{{
			Markdown:  "A reflection grounded in the transcript." + references.String(),
			Citations: citations,
		}},
	}, nil
}

func TestJournalPeriodBoundsUseRequestedTimeZone(t *testing.T) {
	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, time.July, 26, 23, 30, 0, 0, time.UTC)
	start, end := periodBounds(at, location, "day")

	if got, want := start.Format(time.RFC3339), "2026-07-26T07:00:00Z"; got != want {
		t.Fatalf("day start = %s, want %s", got, want)
	}
	if got, want := end.Format(time.RFC3339), "2026-07-27T07:00:00Z"; got != want {
		t.Fatalf("day end = %s, want %s", got, want)
	}

	start, end = periodBounds(at, location, "week")
	if got, want := start.Format(time.RFC3339), "2026-07-20T07:00:00Z"; got != want {
		t.Fatalf("week start = %s, want %s", got, want)
	}
	if got, want := end.Format(time.RFC3339), "2026-07-27T07:00:00Z"; got != want {
		t.Fatalf("week end = %s, want %s", got, want)
	}
}

func TestValidateJournalSummaryRejectsInventedSegments(t *testing.T) {
	sources := []JournalSummarySource{{
		Label: "entry", Text: "A real transcript segment.",
		Citations: []JournalCitation{{EntryId: "entry-1", SegmentId: "s0", Quote: "Grounded source"}},
	}}
	valid := JournalSummaryResult{
		Title:  "Real",
		Blocks: []JournalSummaryBlock{{Markdown: "Grounded.[^1]", Citations: sources[0].Citations}},
	}
	if err := validateJournalSummary(valid, sources); err != nil {
		t.Fatalf("valid summary rejected: %v", err)
	}
	invalid := JournalSummaryResult{
		Title: "Invented",
		Blocks: []JournalSummaryBlock{{
			Markdown:  "Ungrounded.[^1]",
			Citations: []JournalCitation{{EntryId: "entry-1", SegmentId: "invented", Quote: "Invented source"}},
		}},
	}
	if err := validateJournalSummary(invalid, sources); err == nil {
		t.Fatal("invented citation was accepted")
	}
	tamperedQuote := JournalSummaryResult{
		Title: "Tampered quote",
		Blocks: []JournalSummaryBlock{{
			Markdown:  "Misquoted.[^1]",
			Citations: []JournalCitation{{EntryId: "entry-1", SegmentId: "s0", Quote: "Not what the transcript said"}},
		}},
	}
	if err := validateJournalSummary(tamperedQuote, sources); err == nil {
		t.Fatal("citation with a modified transcript quote was accepted")
	}
	missingReference := JournalSummaryResult{
		Title:  "Missing reference",
		Blocks: []JournalSummaryBlock{{Markdown: "Grounded.", Citations: sources[0].Citations}},
	}
	if err := validateJournalSummary(missingReference, sources); err == nil {
		t.Fatal("citation missing its inline Markdown reference was accepted")
	}
}

func TestSummaryTextOmitsChildCitationReferences(t *testing.T) {
	summary := JournalSummary{Blocks: []JournalSummaryBlock{
		{Markdown: "First claim.[^1]", Citations: []JournalCitation{{EntryId: "entry-1", SegmentId: "s0", Quote: "First source"}}},
		{Markdown: "Second **claim**.[^1][^2]", Citations: []JournalCitation{{EntryId: "entry-1", SegmentId: "s1", Quote: "Second source"}, {EntryId: "entry-2", SegmentId: "s0", Quote: "Third source"}}},
	}}
	if got, want := summaryText(summary), "First claim.\n\nSecond **claim**."; got != want {
		t.Fatalf("summary text = %q, want %q", got, want)
	}
}

func TestJournalIsRestrictedToThomasIndependentOfScope(t *testing.T) {
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: "someone-else",
	})
	if _, err := journalSubject(ctx); err == nil {
		t.Fatal("non-owner subject was allowed to address the journal")
	}
}

func TestLocalJournalSubjectUsesOwnerStoragePartition(t *testing.T) {
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "http://localhost", Subject: journalLocalOwnerSubject,
	})
	subject, err := journalSubject(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if subject != journalOwnerSubject {
		t.Fatalf("local journal subject = %q, want %q", subject, journalOwnerSubject)
	}
}

func TestJournalScopesAreReservedForThomas(t *testing.T) {
	ownerScopes := ensureReservedScopes(journalOwnerSubject, []string{"profile"})
	if !slices.Contains(ownerScopes, "journal_read") || !slices.Contains(ownerScopes, "journal_write") {
		t.Fatalf("owner scopes = %v, want both journal scopes", ownerScopes)
	}
	nonOwnerScopes := ensureReservedScopes("someone-else", []string{"profile", "journal_read", "journal_write"})
	if slices.Contains(nonOwnerScopes, "journal_read") || slices.Contains(nonOwnerScopes, "journal_write") {
		t.Fatalf("non-owner retained reserved journal scopes: %v", nonOwnerScopes)
	}
}

func TestProcessJournalUploadUsesSpokenDateOnlyWithoutContainerMetadata(t *testing.T) {
	fallbackRecordedAt := time.Date(2026, time.August, 14, 18, 25, 0, 0, time.UTC)
	embeddedRecordedAt := time.Date(2026, time.August, 12, 19, 16, 0, 0, time.UTC)
	for _, test := range []struct {
		name        string
		contentType string
		audio       []byte
		want        time.Time
	}{
		{
			name:        "fallback timestamp",
			contentType: "audio/wav",
			audio:       []byte("audio without creation metadata"),
			want:        time.Date(2026, time.August, 13, 18, 25, 0, 0, time.UTC),
		},
		{
			name:        "embedded timestamp",
			contentType: "audio/mp4",
			audio:       testMP4(embeddedRecordedAt, 0),
			want:        embeddedRecordedAt,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			db := &inMemoryDDB{}
			objects := &fakeJournalObjects{}
			server := &Server{
				ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
				journalObjects: objects, journalPresigner: fakeJournalPresigner{},
				journalAI: inferredDateJournalAI{recordedDate: "2026-08-13"},
			}
			ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
				Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
			})
			response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
				Body: &JournalEntryCreate{
					ContentType: JournalEntryCreateContentType(test.contentType),
					RecordedAt:  fallbackRecordedAt,
					TimeZone:    "America/Los_Angeles",
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			entryID := response.(PostJournalEntries201JSONResponse).Entry.Id.String()
			objects.objects[journalEntryKey(entryID)] = test.audio
			if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(test.audio))); err != nil {
				t.Fatal(err)
			}
			journalResponse, err := server.GetJournal(ctx, GetJournalRequestObject{})
			if err != nil {
				t.Fatal(err)
			}
			entry := journalResponse.(GetJournal200JSONResponse).Entries[0]
			if !entry.RecordedAt.Equal(test.want) {
				t.Fatalf("recordedAt = %v, want %v", entry.RecordedAt, test.want)
			}
			if entry.Summary == nil || !entry.Summary.Start.Equal(test.want) {
				t.Fatalf("entry summary = %#v, want start %v", entry.Summary, test.want)
			}
		})
	}
}

func TestCreateAndProcessJournalUploadOmitsSingletonAggregates(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: objects, journalPresigner: fakeJournalPresigner{}, journalAI: fakeJournalAI{},
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	fallbackRecordedAt := time.Date(2026, time.July, 26, 20, 0, 0, 0, time.UTC)
	audioRecordedAt := time.Date(2026, time.July, 25, 10, 15, 0, 0, time.UTC)
	response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
		Body: &JournalEntryCreate{
			ContentType: JournalEntryCreateContentType("audio/mp4"),
			RecordedAt:  fallbackRecordedAt,
			TimeZone:    "America/Los_Angeles",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	created, ok := response.(PostJournalEntries201JSONResponse)
	if !ok {
		t.Fatalf("unexpected create response: %#v", response)
	}
	if created.Entry.Status != JournalEntryStatus("awaiting_upload") {
		t.Fatalf("status = %q, want awaiting_upload", created.Entry.Status)
	}
	if created.Entry.ByteLength != 0 || created.Entry.DurationMs != 0 {
		t.Fatalf("unprocessed entry has derived audio metadata: %#v", created.Entry)
	}
	pendingJSON, err := json.Marshal(created.Entry)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(pendingJSON, []byte(`"byteLength"`)) || bytes.Contains(pendingJSON, []byte(`"durationMs"`)) {
		t.Fatalf("pending entry serialized unknown audio metadata: %s", pendingJSON)
	}
	if got := created.Upload.Headers["If-None-Match"]; got != "*" {
		t.Fatalf("If-None-Match = %q, want upload overwrite protection", got)
	}
	entryID := created.Entry.Id.String()
	audio := testMP4(audioRecordedAt, 0)
	objects.objects[journalEntryKey(entryID)] = audio
	if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(audio))); err != nil {
		t.Fatal(err)
	}
	if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(audio))); err != nil {
		t.Fatalf("repeated upload notification: %v", err)
	}

	journalResponse, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal, ok := journalResponse.(GetJournal200JSONResponse)
	if !ok {
		t.Fatalf("unexpected journal response: %#v", journalResponse)
	}
	if len(journal.Entries) != 1 || journal.Entries[0].Status != JournalEntryStatus("ready") {
		t.Fatalf("entries = %#v, want one ready entry", journal.Entries)
	}
	if journal.Entries[0].ByteLength != int64(len(audio)) || journal.Entries[0].DurationMs != 1750 {
		t.Fatalf("derived audio metadata = %d bytes/%d ms, want %d bytes/1750 ms", journal.Entries[0].ByteLength, journal.Entries[0].DurationMs, len(audio))
	}
	if !journal.Entries[0].RecordedAt.Equal(audioRecordedAt) {
		t.Fatalf("recordedAt = %v, want embedded audio creation time %v", journal.Entries[0].RecordedAt, audioRecordedAt)
	}
	if journal.Entries[0].Summary == nil || len(journal.Entries[0].Summary.Blocks[0].Citations) != 1 {
		t.Fatalf("entry summary citations = %#v", journal.Entries[0].Summary)
	}
	if len(journal.Summaries) != 0 {
		t.Fatalf("single upload generated %d aggregate summaries", len(journal.Summaries))
	}
	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	legacyResult := JournalSummaryResult{
		Title:  "Legacy singleton",
		Blocks: journal.Entries[0].Summary.Blocks,
	}
	for _, period := range journalAggregatePeriods {
		start, end := periodBounds(audioRecordedAt, location, string(period))
		summary := summaryRecord(string(period)+":"+start.Format(time.RFC3339), period, start, end, legacyResult, "legacy-singleton")
		if err := server.putJournalRecord(ctx, JournalStoredRecord{
			Id: journalOwnerSubject, When: "SUMMARY#" + string(period) + "#" + start.Format(time.RFC3339),
			Kind: JournalStoredRecordKindSummary, Summary: &summary,
		}); err != nil {
			t.Fatal(err)
		}
		objects.objects[journalAggregateObjectKey(period, start)] = []byte("legacy singleton")
	}
	if err := server.RefreshJournalSummaries(ctx, time.Date(2027, time.January, 1, 8, 5, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	journalResponse, err = server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal = journalResponse.(GetJournal200JSONResponse)
	if len(journal.Summaries) != 0 {
		t.Fatalf("scheduled refresh generated %d singleton aggregate summaries", len(journal.Summaries))
	}
	for _, key := range []string{
		"entries/" + entryID + "/metadata.json",
		"entries/" + entryID + "/transcript.json",
		"entries/" + entryID + "/summary.json",
	} {
		if _, ok := objects.objects[key]; !ok {
			t.Errorf("missing canonical S3 object %s", key)
		}
	}
	for key := range objects.objects {
		if strings.HasPrefix(key, "aggregates/") {
			t.Errorf("single entry wrote redundant aggregate object %s", key)
		}
	}
	var metadata JournalEntryMetadata
	if err := json.Unmarshal(objects.objects["entries/"+entryID+"/metadata.json"], &metadata); err != nil {
		t.Fatal(err)
	}
	if metadata.Id != entryID || metadata.Status != JournalEntryStatusReady || !metadata.RecordedAt.Equal(audioRecordedAt) {
		t.Fatalf("metadata = %#v, want ready entry %s", metadata, entryID)
	}
	wantContentSHA256 := fmt.Sprintf("%x", sha256.Sum256(audio))
	if metadata.ContentSha256 != wantContentSHA256 {
		t.Fatalf("metadata content hash = %q, want %q", metadata.ContentSha256, wantContentSHA256)
	}
	var transcript JournalTranscriptFile
	if err := json.Unmarshal(objects.objects["entries/"+entryID+"/transcript.json"], &transcript); err != nil {
		t.Fatal(err)
	}
	if transcript.EntryId != entryID || len(transcript.Segments) != 1 {
		t.Fatalf("transcript = %#v, want one segment for %s", transcript, entryID)
	}
}

func TestJournalSummariesRefreshMeaningfulHierarchyAfterEachUpload(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	ai := &recordingJournalAI{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: objects, journalPresigner: fakeJournalPresigner{}, journalAI: ai,
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	upload := func(index int, recordedAt time.Time) {
		t.Helper()
		response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
			Body: &JournalEntryCreate{
				ContentType: JournalEntryCreateContentType("audio/mp4"),
				RecordedAt:  recordedAt,
				TimeZone:    "America/Los_Angeles",
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		created, ok := response.(PostJournalEntries201JSONResponse)
		if !ok {
			t.Fatalf("create response %d = %#v", index, response)
		}
		entryID := created.Entry.Id.String()
		audio := fmt.Appendf(nil, "voice-%d", index)
		objects.objects[journalEntryKey(entryID)] = audio
		if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(audio))); err != nil {
			t.Fatalf("process entry %d: %v", index, err)
		}
	}
	counts := func() map[string]int {
		result := map[string]int{}
		for _, period := range ai.periods {
			result[period]++
		}
		return result
	}
	assertCounts := func(want map[string]int) {
		t.Helper()
		got := counts()
		for _, period := range []string{"entry", "day", "week", "month", "year"} {
			if got[period] != want[period] {
				t.Errorf("%s summary calls = %d, want %d; all calls: %v", period, got[period], want[period], got)
			}
		}
	}

	// A second entry makes its day meaningful, but the containing week,
	// month, and year still contain only one child unit.
	upload(0, time.Date(2026, time.July, 25, 20, 0, 0, 0, time.UTC))
	assertCounts(map[string]int{"entry": 1})
	upload(1, time.Date(2026, time.July, 25, 21, 0, 0, 0, time.UTC))
	assertCounts(map[string]int{"entry": 2, "day": 1})

	// A singleton entry on a second day is passed through to its parents,
	// allowing the week and month to summarize two days without creating a
	// redundant summary for that singleton day.
	upload(2, time.Date(2026, time.July, 26, 20, 0, 0, 0, time.UTC))
	assertCounts(map[string]int{"entry": 3, "day": 1, "week": 1, "month": 1})

	// A singleton entry in a second month similarly makes the year useful.
	upload(3, time.Date(2026, time.August, 2, 20, 0, 0, 0, time.UTC))
	assertCounts(map[string]int{"entry": 4, "day": 1, "week": 1, "month": 1, "year": 1})

	// Adding another entry to an existing day refreshes every meaningful
	// ancestor because each source fingerprint changes in hierarchy order.
	upload(4, time.Date(2026, time.July, 25, 22, 0, 0, 0, time.UTC))
	assertCounts(map[string]int{"entry": 5, "day": 2, "week": 2, "month": 2, "year": 2})

	beforeScheduledRefresh := counts()
	if err := server.RefreshJournalSummaries(ctx, time.Date(2027, time.January, 1, 8, 5, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if got := counts(); !maps.Equal(got, beforeScheduledRefresh) {
		t.Fatalf("scheduled backfill regenerated current summaries: got %v, want %v", got, beforeScheduledRefresh)
	}

	response, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal, ok := response.(GetJournal200JSONResponse)
	if !ok {
		t.Fatalf("journal response = %#v", response)
	}
	if len(journal.Entries) != 5 {
		t.Fatalf("entries = %d, want 5", len(journal.Entries))
	}
	if len(journal.Summaries) != 4 {
		t.Fatalf("summaries = %d, want day/week/month/year", len(journal.Summaries))
	}
	wantCitations := map[JournalSummaryPeriod]int{
		JournalSummaryPeriodDay: 3, JournalSummaryPeriodWeek: 4,
		JournalSummaryPeriodMonth: 4, JournalSummaryPeriodYear: 5,
	}
	for _, summary := range journal.Summaries {
		if got, want := len(summary.Blocks[0].Citations), wantCitations[summary.Period]; got != want {
			t.Errorf("%s summary citations = %d, want %d", summary.Period, got, want)
		}
		if summary.SourceFingerprint == "" {
			t.Errorf("%s summary has no source fingerprint", summary.Period)
		}
	}
}

func TestJournalDuplicateAudioHashKeepsSingleEntry(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	ai := &recordingJournalAI{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: objects, journalPresigner: fakeJournalPresigner{}, journalAI: ai,
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	audio := []byte("the exact same voice note")
	entryIDs := make([]string, 0, 2)
	for index := range 2 {
		response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
			Body: &JournalEntryCreate{
				ContentType: JournalEntryCreateContentType("audio/wav"),
				RecordedAt:  time.Date(2026, time.August, 13, 12+index, 0, 0, 0, time.UTC),
				TimeZone:    "America/Los_Angeles",
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		entryID := response.(PostJournalEntries201JSONResponse).Entry.Id.String()
		entryIDs = append(entryIDs, entryID)
		objects.objects[journalEntryKey(entryID)] = append([]byte(nil), audio...)
		if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(audio))); err != nil {
			t.Fatalf("process upload %d: %v", index, err)
		}
	}

	response, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if len(journal.Entries) != 1 || journal.Entries[0].Id.String() != entryIDs[0] {
		t.Fatalf("entries = %#v, want only the first copy %s", journal.Entries, entryIDs[0])
	}
	if got := len(ai.periods); got != 1 || ai.periods[0] != "entry" {
		t.Fatalf("AI summary calls = %v, want one entry call", ai.periods)
	}
	for _, suffix := range []string{"source", "metadata.json", "transcript.json", "summary.json"} {
		key := "entries/" + entryIDs[1] + "/" + suffix
		if _, ok := objects.objects[key]; ok {
			t.Errorf("duplicate object %s was not removed", key)
		}
	}
}

func TestJournalUploadSizeComesFromObjectEvent(t *testing.T) {
	db := &inMemoryDDB{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: &fakeJournalObjects{}, journalPresigner: fakeJournalPresigner{}, journalAI: fakeJournalAI{},
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
		Body: &JournalEntryCreate{
			ContentType: JournalEntryCreateContentType("audio/mp4"),
			RecordedAt:  time.Date(2026, time.July, 26, 20, 0, 0, 0, time.UTC),
			TimeZone:    "America/Los_Angeles",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	created := response.(PostJournalEntries201JSONResponse)
	size := int64(maxJournalAudioBytes + 1)
	if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(created.Entry.Id.String()), size); err == nil {
		t.Fatal("oversized S3 object was accepted")
	}

	journalResponse, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := journalResponse.(GetJournal200JSONResponse)
	if len(journal.Entries) != 0 {
		t.Fatalf("journal entries = %#v, want failed upload omitted", journal.Entries)
	}
	records, err := server.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	entry, err := server.findJournalEntry(records, created.Entry.Id.String())
	if err != nil {
		t.Fatal(err)
	}
	if entry.Status != JournalEntryStatusFailed || entry.ByteLength != size {
		t.Fatalf("stored failed upload = %#v, want authoritative size %d", entry, size)
	}
}

func TestGetJournalShowsOnlyReadyAndActiveEntries(t *testing.T) {
	db := &inMemoryDDB{}
	server := &Server{ddb: db, journalTableName: "journal"}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	now := time.Now().UTC()
	activeExpiry := now.Add(time.Minute)
	expired := now.Add(-time.Minute)
	entries := []JournalStoredEntry{
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000011", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "ready", Status: JournalEntryStatusReady, Transcript: []JournalTranscriptSegment{}},
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000012", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "processing", Status: JournalEntryStatusProcessing, Transcript: []JournalTranscriptSegment{}},
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000013", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "uploading", Status: JournalEntryStatusAwaitingUpload, UploadExpiresAt: &activeExpiry, Transcript: []JournalTranscriptSegment{}},
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000014", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "failed", Status: JournalEntryStatusFailed, Transcript: []JournalTranscriptSegment{}},
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000015", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "expired", Status: JournalEntryStatusAwaitingUpload, UploadExpiresAt: &expired, Transcript: []JournalTranscriptSegment{}},
		{SchemaVersion: 1, Id: "00000000-0000-4000-8000-000000000016", RecordedAt: now, TimeZone: "UTC", ContentType: "audio/mp4", AudioKey: "legacy", Status: JournalEntryStatusAwaitingUpload, Transcript: []JournalTranscriptSegment{}},
	}
	for _, entry := range entries {
		if err := server.putJournalRecord(ctx, JournalStoredRecord{
			Id: journalOwnerSubject, When: journalEntryRecordKey(entry.Id), Kind: JournalStoredRecordKindEntry, Entry: &entry,
		}); err != nil {
			t.Fatal(err)
		}
	}

	response, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	got := make([]string, 0, len(journal.Entries))
	for _, entry := range journal.Entries {
		got = append(got, entry.Id.String())
	}
	slices.Sort(got)
	if want := []string{
		"00000000-0000-4000-8000-000000000011",
		"00000000-0000-4000-8000-000000000012",
		"00000000-0000-4000-8000-000000000013",
	}; !slices.Equal(got, want) {
		t.Fatalf("visible entry IDs = %v, want %v", got, want)
	}
}

func TestDeleteJournalEntryDeletesAwaitingUpload(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: objects, journalPresigner: fakeJournalPresigner{},
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	createdResponse, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
		Body: &JournalEntryCreate{
			ContentType: JournalEntryCreateContentType("audio/mp4"),
			RecordedAt:  time.Now().UTC(),
			TimeZone:    "America/Los_Angeles",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	created := createdResponse.(PostJournalEntries201JSONResponse)
	response, err := server.DeleteJournalEntriesEntryId(ctx, DeleteJournalEntriesEntryIdRequestObject{
		EntryId: created.Entry.Id,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := response.(DeleteJournalEntriesEntryId204Response); !ok {
		t.Fatalf("delete response = %#v, want 204", response)
	}
	records, err := server.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Fatalf("records after abandoning upload = %#v, want none", records)
	}
	if len(objects.objects) != 0 {
		t.Fatalf("objects after abandoning upload = %#v, want none", objects.objects)
	}
}

func TestDeleteJournalEntryRejectsProcessingEntry(t *testing.T) {
	db := &inMemoryDDB{}
	server := &Server{ddb: db, journalTableName: "journal"}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	entry := JournalStoredEntry{
		SchemaVersion: 1,
		Id:            "00000000-0000-4000-8000-000000000017",
		RecordedAt:    time.Now().UTC(),
		TimeZone:      "America/Los_Angeles",
		ContentType:   "audio/mp4",
		AudioKey:      "entries/00000000-0000-4000-8000-000000000017/source",
		Status:        JournalEntryStatusProcessing,
		Transcript:    []JournalTranscriptSegment{},
	}
	if err := server.putJournalRecord(ctx, JournalStoredRecord{
		Id: journalOwnerSubject, When: journalEntryRecordKey(entry.Id), Kind: JournalStoredRecordKindEntry, Entry: &entry,
	}); err != nil {
		t.Fatal(err)
	}
	response, err := server.DeleteJournalEntriesEntryId(ctx, DeleteJournalEntriesEntryIdRequestObject{
		EntryId: openapiUUID(entry.Id),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := response.(DeleteJournalEntriesEntryId409JSONResponse); !ok {
		t.Fatalf("delete response = %#v, want 409", response)
	}
	records, err := server.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].Entry == nil || records[0].Entry.Id != entry.Id {
		t.Fatalf("records after rejected deletion = %#v, want processing entry", records)
	}
}

func TestDeleteReadyJournalEntryRemovesFilesHashAndAggregateSummary(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	server := &Server{
		ddb: db, journalTableName: "journal", journalBucketName: "journal-audio",
		journalObjects: objects, journalPresigner: fakeJournalPresigner{}, journalAI: &recordingJournalAI{},
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
	})
	recordedAt := time.Date(2026, time.August, 13, 19, 16, 0, 0, time.UTC)
	for index := range 2 {
		createdResponse, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
			Body: &JournalEntryCreate{
				ContentType: JournalEntryCreateContentType("audio/mp4"),
				RecordedAt:  recordedAt.Add(time.Duration(index) * time.Hour),
				TimeZone:    "America/Los_Angeles",
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		entryID := createdResponse.(PostJournalEntries201JSONResponse).Entry.Id.String()
		audio := fmt.Appendf(nil, "delete-ready-%d", index)
		objects.objects[journalEntryKey(entryID)] = audio
		if err := server.ProcessJournalUpload(ctx, "journal-audio", journalEntryKey(entryID), int64(len(audio))); err != nil {
			t.Fatal(err)
		}
	}

	response, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if len(journal.Entries) != 2 || len(journal.Summaries) != 1 || journal.Summaries[0].Period != JournalSummaryPeriodDay {
		t.Fatalf("journal before deletion = %#v, want two entries and a day summary", journal)
	}
	deleted := journal.Entries[0]
	var deletedContentSHA256 string
	for _, record := range db.journal {
		var stored JournalStoredRecord
		if err := attributevalue.UnmarshalMap(record, &stored); err != nil {
			t.Fatal(err)
		}
		if stored.Entry != nil && stored.Entry.Id == deleted.Id.String() {
			deletedContentSHA256 = stored.Entry.ContentSha256
		}
	}
	if deletedContentSHA256 == "" {
		t.Fatal("ready entry has no stored content hash")
	}
	responseObject, err := server.DeleteJournalEntriesEntryId(ctx, DeleteJournalEntriesEntryIdRequestObject{
		EntryId: deleted.Id,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := responseObject.(DeleteJournalEntriesEntryId204Response); !ok {
		t.Fatalf("delete response = %#v, want 204", responseObject)
	}

	response, err = server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal = response.(GetJournal200JSONResponse)
	if len(journal.Entries) != 1 || journal.Entries[0].Id == deleted.Id {
		t.Fatalf("entries after deletion = %#v, want only the other entry", journal.Entries)
	}
	if len(journal.Summaries) != 0 {
		t.Fatalf("summaries after deletion = %#v, want no singleton aggregate", journal.Summaries)
	}
	for _, key := range []string{
		journalEntryKey(deleted.Id.String()),
		"entries/" + deleted.Id.String() + "/metadata.json",
		"entries/" + deleted.Id.String() + "/transcript.json",
		"entries/" + deleted.Id.String() + "/summary.json",
	} {
		if _, ok := objects.objects[key]; ok {
			t.Errorf("deleted entry object %q remains", key)
		}
	}
	for _, record := range db.journal {
		if strings.Contains(keyTableRecordID(record), deletedContentSHA256) || keyTableRecordWhen(record) == journalEntryRecordKey(deleted.Id.String()) {
			t.Errorf("deleted entry record remains: %#v", record)
		}
	}
	if _, ok := objects.objects[journalAggregateObjectKey(JournalSummaryPeriodDay, recordedAt)]; ok {
		t.Error("deleted day aggregate object remains")
	}

	responseObject, err = server.DeleteJournalEntriesEntryId(ctx, DeleteJournalEntriesEntryIdRequestObject{
		EntryId: deleted.Id,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := responseObject.(DeleteJournalEntriesEntryId204Response); !ok {
		t.Fatalf("repeated delete response = %#v, want idempotent 204", responseObject)
	}
}

func TestProcessJournalUploadIgnoresSidecarNotifications(t *testing.T) {
	server := &Server{journalBucketName: "journal-audio"}
	if err := server.ProcessJournalUpload(context.Background(), "journal-audio", "entries/id/metadata.json", 1); err != nil {
		t.Fatal(err)
	}
}
