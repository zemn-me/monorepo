package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
)

const (
	journalTranscriptionModel = "whisper-1"
	journalSummaryModel       = "gpt-5.6"
)

type journalTranscriptSegment struct {
	ID           string  `json:"id"`
	StartSeconds float64 `json:"startSeconds"`
	EndSeconds   float64 `json:"endSeconds"`
	Text         string  `json:"text"`
}

type journalCitation struct {
	EntryID   string `json:"entryId"`
	SegmentID string `json:"segmentId"`
}

type journalSummaryResult struct {
	Title     string            `json:"title"`
	Body      string            `json:"body"`
	Themes    []string          `json:"themes"`
	Citations []journalCitation `json:"citations"`
}

type journalSummarySource struct {
	Label     string            `json:"label"`
	Text      string            `json:"text"`
	Citations []journalCitation `json:"citations"`
}

type JournalAI interface {
	Transcribe(ctx context.Context, audio []byte, contentType string) ([]journalTranscriptSegment, error)
	Summarize(ctx context.Context, period string, sources []journalSummarySource) (journalSummaryResult, error)
}

type openAIJournalAI struct {
	apiKey string
	client *http.Client
}

func newOpenAIJournalAI(apiKey string) JournalAI {
	return &openAIJournalAI{apiKey: apiKey, client: http.DefaultClient}
}

func (o *openAIJournalAI) request(ctx context.Context, req *http.Request) (*http.Response, error) {
	if o.apiKey == "" {
		return nil, errors.New("OPENAI_API_KEY is not configured")
	}
	req = req.WithContext(ctx)
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	return o.client.Do(req)
}

func (o *openAIJournalAI) Transcribe(ctx context.Context, audio []byte, contentType string) ([]journalTranscriptSegment, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="file"; filename="voice-note"`)
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(audio); err != nil {
		return nil, err
	}
	for key, value := range map[string]string{
		"model":           journalTranscriptionModel,
		"response_format": "verbose_json",
	} {
		if err := writer.WriteField(key, value); err != nil {
			return nil, err
		}
	}
	if err := writer.WriteField("timestamp_granularities[]", "segment"); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/audio/transcriptions", &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := o.request(ctx, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("OpenAI transcription returned %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	var result struct {
		Segments []struct {
			ID    int     `json:"id"`
			Start float64 `json:"start"`
			End   float64 `json:"end"`
			Text  string  `json:"text"`
		} `json:"segments"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	segments := make([]journalTranscriptSegment, 0, len(result.Segments))
	for index, segment := range result.Segments {
		id := segment.ID
		if id < 0 {
			id = index
		}
		segments = append(segments, journalTranscriptSegment{
			ID:           fmt.Sprintf("s%d", id),
			StartSeconds: segment.Start,
			EndSeconds:   segment.End,
			Text:         strings.TrimSpace(segment.Text),
		})
	}
	if len(segments) == 0 {
		return nil, errors.New("OpenAI returned an empty transcript")
	}
	return segments, nil
}

func journalSummarySchema() map[string]any {
	citation := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"entryId", "segmentId"},
		"properties": map[string]any{
			"entryId":   map[string]any{"type": "string"},
			"segmentId": map[string]any{"type": "string"},
		},
	}
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"title", "body", "themes", "citations"},
		"properties": map[string]any{
			"title":     map[string]any{"type": "string"},
			"body":      map[string]any{"type": "string"},
			"themes":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"citations": map[string]any{"type": "array", "items": citation},
		},
	}
}

func (o *openAIJournalAI) Summarize(ctx context.Context, period string, sources []journalSummarySource) (journalSummaryResult, error) {
	input, err := json.Marshal(sources)
	if err != nil {
		return journalSummaryResult{}, err
	}
	payload := map[string]any{
		"model": journalSummaryModel,
		"store": false,
		"reasoning": map[string]any{
			"effort": "medium",
		},
		"input": []map[string]any{
			{
				"role":    "system",
				"content": "Summarize a private voice journal. Identify the overarching themes for the requested time period. Every factual claim must be supported by one or more citation objects copied exactly from the supplied sources. Never invent an entryId or segmentId. Keep the body concise and reflective, not diagnostic.",
			},
			{
				"role":    "user",
				"content": fmt.Sprintf("Create the %s summary from these sources:\n%s", period, input),
			},
		},
		"text": map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "journal_summary",
				"strict": true,
				"schema": journalSummarySchema(),
			},
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return journalSummaryResult{}, err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/responses", bytes.NewReader(encoded))
	if err != nil {
		return journalSummaryResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := o.request(ctx, req)
	if err != nil {
		return journalSummaryResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return journalSummaryResult{}, fmt.Errorf("OpenAI summary returned %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	var result struct {
		Output []struct {
			Type    string `json:"type"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return journalSummaryResult{}, err
	}
	for _, output := range result.Output {
		for _, content := range output.Content {
			if content.Type != "output_text" {
				continue
			}
			var summary journalSummaryResult
			if err := json.Unmarshal([]byte(content.Text), &summary); err != nil {
				return journalSummaryResult{}, err
			}
			if err := validateJournalCitations(summary.Citations, sources); err != nil {
				return journalSummaryResult{}, err
			}
			return summary, nil
		}
	}
	return journalSummaryResult{}, errors.New("OpenAI response did not contain summary text")
}

func validateJournalCitations(citations []journalCitation, sources []journalSummarySource) error {
	allowed := map[journalCitation]struct{}{}
	for _, source := range sources {
		for _, citation := range source.Citations {
			allowed[citation] = struct{}{}
		}
	}
	for _, citation := range citations {
		if _, ok := allowed[citation]; !ok {
			return fmt.Errorf("summary cited unknown transcript segment %s/%s", citation.EntryID, citation.SegmentID)
		}
	}
	return nil
}
