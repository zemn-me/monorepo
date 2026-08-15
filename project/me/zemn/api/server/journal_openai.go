package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/invopop/jsonschema"
	openaiauth "github.com/openai/openai-go/v3/auth"
	openaiapi "github.com/zemn-me/monorepo/go/openai"
)

const (
	journalTranscriptionModel  = "whisper-1"
	journalTranscriptionPrompt = "Today, I reflected on my day. What went well? I felt calm, focused, and grateful. When I quote someone, I use quotation marks; contractions, such as I'm, keep their apostrophes."
	journalSummaryModel        = "gpt-5.6"
	openAIWorkloadAudience     = "https://api.openai.com/v1"
)

const journalSummaryInstructions = `The goal of this private voice journal is to help Thomas understand the story of his life and thinking over time.

Write a narrative summary of what happened in the supplied journal material, not a keyword sample or a list of themes. Return a short title and one or more concise Markdown blocks.

For an individual entry, explain what Thomas discussed and how the reflection moved. For a day, week, month, or year, synthesize the development across the supplied sources into an arc; do not concatenate lower-level summaries or recap them one by one.

When present in the source, track emotional movement such as affection, conflict, repair, intimacy, distance, rupture, reconnection, humor, planning, and recurring anxieties. Also track concrete events such as travel, meetings, work, family, health, romance, money, housing, conflicts, apologies, plans, and decisions. Do not force these categories into material where they are not relevant.

Preserve uncertainty. Distinguish what Thomas directly said from interpretation, qualify inferences, and say plainly when context is missing or unclear. Do not invent motives, diagnoses, events, feelings, or relationships.

Write natural prose. Do not use generic headings or labels such as "Theme", "Themes", or "Key themes". Use a content-specific Markdown heading only when it genuinely makes a longer summary easier to read.

Every Markdown block must be supported by one or more citation objects copied exactly from the supplied sources. Use ordinary numbered Markdown footnotes: in each block, put [^1] immediately after the claim supported by the first object in that block's citations array, [^2] for the second, and so on. Reference every citation object inline at least once. The client renders each numbered reference with the exact quoted transcript segment and its timestamp link. Never invent an entryId or segmentId.`

const journalEntryAnalysisInstructions = journalSummaryInstructions + `

For an individual entry, also determine whether the speaker explicitly assigns this recording or journal entry to a local calendar date. Phrases such as "this entry is from 13 August", "this is for 13 August", and "today is 13 August" establish that date even if the audio file was created at a different time. Do not require the speaker to say that the audio is being recorded on that date.

Set recordedDate to YYYY-MM-DD only when the speaker explicitly states or unambiguously identifies the date assigned to the entry. The provisional timestamp and time zone may be used to resolve an omitted year or an explicit relative phrase assigning the entry to a date. Do not mistake the date of a remembered, planned, or otherwise discussed event for the entry's date. When the entry date is not established clearly enough, set recordedDate to an empty string.`

type JournalAI interface {
	Transcribe(ctx context.Context, audio io.Reader, contentType string) (JournalTranscriptionResult, error)
	AnalyzeEntry(ctx context.Context, provisionalRecordedAt time.Time, timeZone string, sources []JournalSummarySource) (JournalEntryAnalysisResult, error)
	Summarize(ctx context.Context, period string, sources []JournalSummarySource) (JournalSummaryResult, error)
}

type openAIJournalAI struct {
	apiKey           string
	workloadIdentity *openaiauth.WorkloadIdentityAuth
	client           *http.Client
}

func newOpenAIJournalAI(apiKey string) JournalAI {
	return &openAIJournalAI{apiKey: apiKey, client: http.DefaultClient}
}

// NewOpenAIJournalAI constructs the journal AI used by development servers
// that explicitly opt into live OpenAI calls.
func NewOpenAIJournalAI(apiKey string) JournalAI {
	return newOpenAIJournalAI(apiKey)
}

type journalSTSClient interface {
	GetWebIdentityToken(context.Context, *sts.GetWebIdentityTokenInput, ...func(*sts.Options)) (*sts.GetWebIdentityTokenOutput, error)
}

type awsOutboundIdentityTokenProvider struct {
	client journalSTSClient
}

func (p awsOutboundIdentityTokenProvider) TokenType() openaiauth.SubjectTokenType {
	return openaiauth.SubjectTokenTypeJWT
}

func (p awsOutboundIdentityTokenProvider) GetToken(ctx context.Context, _ openaiauth.HTTPDoer) (string, error) {
	output, err := p.client.GetWebIdentityToken(ctx, &sts.GetWebIdentityTokenInput{
		Audience:         []string{openAIWorkloadAudience},
		DurationSeconds:  aws.Int32(300),
		SigningAlgorithm: aws.String("ES384"),
	})
	if err != nil {
		return "", fmt.Errorf("request AWS outbound identity token: %w", err)
	}
	token := aws.ToString(output.WebIdentityToken)
	if token == "" {
		return "", errors.New("AWS STS returned an empty outbound identity token")
	}
	return token, nil
}

func newOpenAIJournalAIWithWorkloadIdentity(identityProviderID, serviceAccountID string, stsClient journalSTSClient) (JournalAI, error) {
	workloadIdentity, err := openaiauth.NewWorkloadIdentityAuth(openaiauth.WorkloadIdentity{
		IdentityProviderID:   identityProviderID,
		ServiceAccountID:     serviceAccountID,
		Provider:             awsOutboundIdentityTokenProvider{client: stsClient},
		RefreshBufferSeconds: 60,
	})
	if err != nil {
		return nil, err
	}
	return &openAIJournalAI{workloadIdentity: workloadIdentity, client: http.DefaultClient}, nil
}

func (o *openAIJournalAI) request(ctx context.Context, req *http.Request) (*http.Response, error) {
	req = req.WithContext(ctx)
	if o.workloadIdentity != nil {
		response, err := openaiauth.WorkloadIdentityMiddleware(o.workloadIdentity, o.client, req, o.client.Do)
		if err != nil {
			return nil, fmt.Errorf("authenticate to OpenAI with workload identity: %w", err)
		}
		return response, nil
	}
	if o.apiKey == "" {
		return nil, errors.New("OpenAI credentials are not configured")
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	return o.client.Do(req)
}

func journalAudioExtension(contentType string) string {
	switch contentType {
	case "audio/mp4":
		return ".m4a"
	case "audio/mpeg":
		return ".mp3"
	case "audio/ogg":
		return ".ogg"
	case "audio/wav":
		return ".wav"
	case "audio/webm":
		return ".webm"
	default:
		return ""
	}
}

func journalTranscriptionBody(audio io.Reader, contentType string) (io.ReadCloser, string) {
	reader, pipe := io.Pipe()
	writer := multipart.NewWriter(pipe)
	multipartContentType := writer.FormDataContentType()
	go func() {
		closeWithError := func(err error) {
			_ = pipe.CloseWithError(err)
		}

		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="voice-note%s"`, journalAudioExtension(contentType)))
		header.Set("Content-Type", contentType)
		part, err := writer.CreatePart(header)
		if err != nil {
			closeWithError(err)
			return
		}
		if _, err := io.Copy(part, audio); err != nil {
			closeWithError(err)
			return
		}
		// Whisper treats its prompt as preceding transcript context, so
		// punctuation-rich prose demonstrates the desired transcript style.
		for key, value := range map[string]string{
			"model":           journalTranscriptionModel,
			"prompt":          journalTranscriptionPrompt,
			"response_format": "verbose_json",
		} {
			if err := writer.WriteField(key, value); err != nil {
				closeWithError(err)
				return
			}
		}
		if err := writer.WriteField("timestamp_granularities[]", "segment"); err != nil {
			closeWithError(err)
			return
		}
		if err := writer.Close(); err != nil {
			closeWithError(err)
			return
		}
		_ = pipe.Close()
	}()
	return reader, multipartContentType
}

func (o *openAIJournalAI) Transcribe(ctx context.Context, audio io.Reader, contentType string) (JournalTranscriptionResult, error) {
	body, contentHeader := journalTranscriptionBody(audio, contentType)
	defer body.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/audio/transcriptions", body)
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	req.Header.Set("Content-Type", contentHeader)
	resp, err := o.request(ctx, req)
	if err != nil {
		return JournalTranscriptionResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return JournalTranscriptionResult{}, fmt.Errorf("OpenAI transcription returned %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	var result openaiapi.CreateTranscriptionResponseVerboseJson
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return JournalTranscriptionResult{}, err
	}
	if result.Segments == nil {
		return JournalTranscriptionResult{}, errors.New("OpenAI returned an empty transcript")
	}
	segments := make([]JournalTranscriptSegment, 0, len(*result.Segments))
	for index, segment := range *result.Segments {
		id := segment.Id
		if id < 0 {
			id = index
		}
		segments = append(segments, JournalTranscriptSegment{
			Id:      fmt.Sprintf("s%d", id),
			StartMs: int64(segment.Start * 1000),
			EndMs:   int64(segment.End * 1000),
			Text:    strings.TrimSpace(segment.Text),
		})
	}
	if len(segments) == 0 {
		return JournalTranscriptionResult{}, errors.New("OpenAI returned an empty transcript")
	}
	if result.Duration < 0 {
		return JournalTranscriptionResult{}, errors.New("OpenAI returned a negative audio duration")
	}
	return JournalTranscriptionResult{
		DurationMs: int64(math.Round(result.Duration * 1000)),
		Segments:   segments,
	}, nil
}

func structuredOutputSchema[T any]() (openaiapi.ResponseFormatJsonSchemaSchema, error) {
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:            true,
	}
	var value T
	encoded, err := json.Marshal(reflector.Reflect(value))
	if err != nil {
		return nil, err
	}
	var schema openaiapi.ResponseFormatJsonSchemaSchema
	if err := json.Unmarshal(encoded, &schema); err != nil {
		return nil, err
	}
	return schema, nil
}

var (
	journalEntryAnalysisSchema = sync.OnceValues(structuredOutputSchema[JournalEntryAnalysisResult])
	journalSummarySchema       = sync.OnceValues(structuredOutputSchema[JournalSummaryResult])
)

func (o *openAIJournalAI) structuredResponseText(ctx context.Context, prompt, instructions, schemaName string, schema openaiapi.ResponseFormatJsonSchemaSchema) (string, error) {
	var input openaiapi.InputParam
	if err := input.FromInputParam0(prompt); err != nil {
		return "", err
	}
	var model openaiapi.ModelIdsResponses
	if err := model.FromModelIdsResponses1(journalSummaryModel); err != nil {
		return "", err
	}
	strict := true
	var format openaiapi.TextResponseFormatConfiguration
	if err := format.FromTextResponseFormatJsonSchema(openaiapi.TextResponseFormatJsonSchema{
		Name:   schemaName,
		Schema: schema,
		Strict: &strict,
		Type:   openaiapi.TextResponseFormatJsonSchemaTypeJsonSchema,
	}); err != nil {
		return "", err
	}
	store := false
	reasoningEffort := openaiapi.ReasoningEffort("medium")
	payload := openaiapi.CreateResponse{
		Input:        &input,
		Instructions: ptr(instructions),
		Model:        &model,
		Reasoning: &openaiapi.Reasoning{
			Effort: &reasoningEffort,
		},
		Store: &store,
		Text: &openaiapi.ResponseTextParam{
			Format: &format,
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/responses", bytes.NewReader(encoded))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := o.request(ctx, req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("OpenAI structured response returned %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	var result openaiapi.Response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	for _, output := range result.Output {
		discriminator, err := output.Discriminator()
		if err != nil {
			return "", err
		}
		if discriminator != string(openaiapi.OutputMessageTypeMessage) {
			continue
		}
		message, err := output.AsOutputMessage()
		if err != nil {
			return "", err
		}
		for _, content := range message.Content {
			discriminator, err := content.Discriminator()
			if err != nil {
				return "", err
			}
			if discriminator != string(openaiapi.OutputTextContentTypeOutputText) {
				continue
			}
			outputText, err := content.AsOutputTextContent()
			if err != nil {
				return "", err
			}
			return outputText.Text, nil
		}
	}
	return "", errors.New("OpenAI response did not contain structured output text")
}

func (o *openAIJournalAI) AnalyzeEntry(ctx context.Context, provisionalRecordedAt time.Time, timeZone string, sources []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	sourceJSON, err := json.Marshal(sources)
	if err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	location, err := time.LoadLocation(timeZone)
	if err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	schema, err := journalEntryAnalysisSchema()
	if err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	prompt := fmt.Sprintf(
		"Create the entry analysis from these sources.\nProvisional recording timestamp: %s\nRecording time zone: %s\nSources:\n%s",
		provisionalRecordedAt.In(location).Format(time.RFC3339), timeZone, sourceJSON,
	)
	text, err := o.structuredResponseText(ctx, prompt, journalEntryAnalysisInstructions, "journal_entry_analysis", schema)
	if err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	var analysis JournalEntryAnalysisResult
	if err := json.NewDecoder(strings.NewReader(text)).Decode(&analysis); err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	if err := validateJournalSummary(analysis.Summary, sources); err != nil {
		return JournalEntryAnalysisResult{}, err
	}
	if analysis.RecordedDate != "" {
		if _, err := time.Parse(time.DateOnly, analysis.RecordedDate); err != nil {
			return JournalEntryAnalysisResult{}, fmt.Errorf("invalid inferred journal recording date %q: %w", analysis.RecordedDate, err)
		}
	}
	return analysis, nil
}

func (o *openAIJournalAI) Summarize(ctx context.Context, period string, sources []JournalSummarySource) (JournalSummaryResult, error) {
	sourceJSON, err := json.Marshal(sources)
	if err != nil {
		return JournalSummaryResult{}, err
	}
	schema, err := journalSummarySchema()
	if err != nil {
		return JournalSummaryResult{}, err
	}
	text, err := o.structuredResponseText(
		ctx,
		fmt.Sprintf("Create the %s summary from these sources:\n%s", period, sourceJSON),
		journalSummaryInstructions,
		"journal_summary",
		schema,
	)
	if err != nil {
		return JournalSummaryResult{}, err
	}
	var summary JournalSummaryResult
	if err := json.NewDecoder(strings.NewReader(text)).Decode(&summary); err != nil {
		return JournalSummaryResult{}, err
	}
	if err := validateJournalSummary(summary, sources); err != nil {
		return JournalSummaryResult{}, err
	}
	return summary, nil
}

func validateJournalSummary(summary JournalSummaryResult, sources []JournalSummarySource) error {
	if strings.TrimSpace(summary.Title) == "" || len(summary.Blocks) == 0 {
		return errors.New("summary must contain a title and at least one block")
	}
	for _, block := range summary.Blocks {
		if strings.TrimSpace(block.Markdown) == "" {
			return errors.New("summary blocks must contain markdown")
		}
		if len(block.Citations) == 0 {
			return errors.New("summary blocks must cite at least one transcript segment")
		}
		references, err := journalCitationReferenceIndexes(block.Markdown)
		if err != nil {
			return err
		}
		referenced := make([]bool, len(block.Citations))
		for _, reference := range references {
			if reference < 1 || reference > len(block.Citations) {
				return fmt.Errorf("summary citation reference [^%d] does not index a citation object", reference)
			}
			referenced[reference-1] = true
		}
		for index, present := range referenced {
			if !present {
				return fmt.Errorf("summary citation %d is not referenced inline as [^%d]", index+1, index+1)
			}
		}
		if err := validateJournalCitations(block.Citations, sources); err != nil {
			return err
		}
	}
	return nil
}

func validateJournalCitations(citations []JournalCitation, sources []JournalSummarySource) error {
	allowed := map[JournalCitation]struct{}{}
	for _, source := range sources {
		for _, citation := range source.Citations {
			allowed[citation] = struct{}{}
		}
	}
	for _, citation := range citations {
		if _, ok := allowed[citation]; !ok {
			return fmt.Errorf("summary cited unknown transcript segment %s/%s", citation.EntryId, citation.SegmentId)
		}
	}
	return nil
}
