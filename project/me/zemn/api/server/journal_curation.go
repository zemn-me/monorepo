package apiserver

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

const journalCurationKey = "CURATION"
const journalCurationMaxBytes = 48 * 1024 * 1024

// Bump when the output contract or writing policy changes so unchanged diaries refresh.
const journalCurationVersion = "3"

func journalCurationInputKey(runID string) string {
	return "curation/runs/" + runID + "/input.json"
}

// The application, not the sandbox, owns publication and credentials.
type JournalCurator interface {
	Prepare(context.Context, string, []byte) (string, error)
	Start(context.Context, string, string) error
	Collect(context.Context, string) (*JournalCurationResult, error)
	Cleanup(context.Context, string, string) error
}

type journalCurationState struct {
	ID                   string    `dynamodbav:"id"`
	When                 string    `dynamodbav:"when"`
	Version              string    `dynamodbav:"version"`
	LeaseUntil           time.Time `dynamodbav:"lease_until"`
	RunID                string    `dynamodbav:"run_id"`
	SessionID            string    `dynamodbav:"session_id"`
	Submitted            bool      `dynamodbav:"submitted"`
	StartedAt            time.Time `dynamodbav:"started_at"`
	InputKey             string    `dynamodbav:"input_key"`
	Fingerprint          string    `dynamodbav:"fingerprint"`
	PublishedKey         string    `dynamodbav:"published_key"`
	PublishedFingerprint string    `dynamodbav:"published_fingerprint"`
	PublishedAt          time.Time `dynamodbav:"published_at"`
	Failed               bool      `dynamodbav:"failed"`
	Cleaning             bool      `dynamodbav:"cleaning"`
}

type journalCorpusEntry struct {
	ID         string                     `json:"id"`
	RecordedAt time.Time                  `json:"recordedAt"`
	TimeZone   string                     `json:"timeZone"`
	Transcript []JournalTranscriptSegment `json:"transcript"`
	Summary    *JournalSummary            `json:"summary,omitempty"`
}

type journalCorpus struct {
	Version      string                `json:"version"`
	Entries      []journalCorpusEntry  `json:"entries"`
	Summaries    []JournalSummary      `json:"summaries"`
	Previous     JournalCurationResult `json:"previous"`
	OutputSchema any                   `json:"outputSchema"`
}

type journalGeneration struct {
	Sources map[string]string     `json:"sources"`
	Result  JournalCurationResult `json:"result"`
}

func journalCorpusFromRecords(records []JournalStoredRecord) journalCorpus {
	corpus := journalCorpus{Version: journalCurationVersion, Entries: []journalCorpusEntry{}, Summaries: []JournalSummary{}}
	for _, record := range records {
		if e := record.Entry; e != nil && e.Status == JournalEntryStatusReady {
			corpus.Entries = append(corpus.Entries, journalCorpusEntry{ID: e.Id, RecordedAt: e.RecordedAt, TimeZone: e.TimeZone, Transcript: e.Transcript, Summary: e.Summary})
		}
		if record.Summary != nil {
			corpus.Summaries = append(corpus.Summaries, *record.Summary)
		}
	}
	sort.Slice(corpus.Entries, func(i, j int) bool { return corpus.Entries[i].ID < corpus.Entries[j].ID })
	return corpus
}

func journalCorpusHashes(corpus journalCorpus) (map[string]string, string) {
	hashes := map[string]string{}
	for _, entry := range corpus.Entries {
		entry.Summary = nil // Derived output must not make its own inputs dirty.
		data, _ := json.Marshal(entry)
		hashes[entry.ID] = fmt.Sprintf("%x", sha256.Sum256(data))
	}
	data, _ := json.Marshal(struct {
		Version string
		Sources map[string]string
	}{journalCurationVersion, hashes})
	return hashes, fmt.Sprintf("%x", sha256.Sum256(data))
}

func journalCorpusSources(corpus journalCorpus) []JournalSummarySource {
	var sources []JournalSummarySource
	for _, entry := range corpus.Entries {
		sources = append(sources, transcriptSources(entry.ID, entry.Transcript)...)
	}
	return sources
}

func (s *Server) readJournalCurationState(ctx context.Context) (journalCurationState, error) {
	state := journalCurationState{ID: journalOwnerSubject, When: journalCurationKey}
	result, err := s.ddb.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.journalTableName), ConsistentRead: aws.Bool(true),
		Key: map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: journalOwnerSubject}, "when": &types.AttributeValueMemberS{Value: journalCurationKey}},
	})
	if err != nil {
		return state, err
	}
	if len(result.Item) > 0 {
		err = attributevalue.UnmarshalMap(result.Item, &state)
	}
	return state, err
}

func (s *Server) saveJournalCurationState(ctx context.Context, state *journalCurationState) error {
	previous := state.Version
	next := *state
	next.Version = uuid.NewString()
	item, err := attributevalue.MarshalMap(next)
	if err != nil {
		return err
	}
	input := &dynamodb.PutItemInput{TableName: aws.String(s.journalTableName), Item: item, ConditionExpression: aws.String("attribute_not_exists(#version)"), ExpressionAttributeNames: map[string]string{"#version": "version"}}
	if previous != "" {
		input.ConditionExpression = aws.String("#version = :version")
		input.ExpressionAttributeValues = map[string]types.AttributeValue{":version": &types.AttributeValueMemberS{Value: previous}}
	}
	if _, err = s.ddb.PutItem(ctx, input); err == nil {
		*state = next
	}
	return err
}

func (s *Server) readJournalCurationJSON(ctx context.Context, key string, target any) error {
	object, err := s.journalObjects.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.journalBucketName), Key: aws.String(key)})
	if err != nil {
		return err
	}
	defer object.Body.Close()
	return decodeJournalCurationJSON(object.Body, target)
}

func decodeJournalCurationJSON(reader io.Reader, target any) error {
	data, err := io.ReadAll(io.LimitReader(reader, journalCurationMaxBytes+1))
	if err != nil {
		return err
	}
	if len(data) > journalCurationMaxBytes {
		return errors.New("journal curation document exceeds size limit")
	}
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return errors.New("unexpected trailing curation data")
	}
	return nil
}

// New recordings may coexist with the previous generation. Corrections and
// deletions hide that generation immediately: even uncited prose may have
// depended on a removed source. All read surfaces share this check.
func (s *Server) journalPublishedGeneration(ctx context.Context, records []JournalStoredRecord) (journalGeneration, journalCurationState, error) {
	state, err := s.readJournalCurationState(ctx)
	var generation journalGeneration
	if err != nil || state.PublishedKey == "" {
		return generation, state, err
	}
	if err := s.readJournalCurationJSON(ctx, state.PublishedKey, &generation); err != nil {
		return journalGeneration{}, state, err
	}
	current, _ := journalCorpusHashes(journalCorpusFromRecords(records))
	for id, hash := range generation.Sources {
		if current[id] != hash {
			return journalGeneration{}, state, nil
		}
	}
	return generation, state, nil
}

var journalWikiLinkPattern = regexp.MustCompile(`\]\(\s*([^)]*)\)`)

func validateJournalWikiLinks(blocks []JournalSummaryBlock, pages map[string]bool) error {
	for _, block := range blocks {
		// Generated prose only links to known wiki pages. Citations use footnotes.
		prose := journalCitationReferencePattern.ReplaceAllString(block.Markdown, "")
		if strings.Contains(prose, "][") || strings.Contains(prose, "]:") || strings.Contains(prose, "![") || strings.Contains(prose, "<") {
			return errors.New("use inline wiki links and numbered citation references only")
		}
		for _, match := range journalWikiLinkPattern.FindAllStringSubmatch(block.Markdown, -1) {
			u, err := url.Parse(strings.TrimSpace(match[1]))
			if err != nil || u.Path != "/journal" || u.Host != "" || u.Scheme != "" || u.Fragment != "" || len(u.Query()) != 1 || len(u.Query()["wiki"]) != 1 || !pages[u.Query().Get("wiki")] {
				return errors.New("curation contains an unknown wiki link")
			}
		}
	}
	return nil
}

func validateJournalCuration(result JournalCurationResult, corpus journalCorpus) error {
	if result.Pages == nil || result.Entries == nil {
		return errors.New("curation requires entries and pages arrays")
	}
	allowed := journalAllowedCitations(journalCorpusSources(corpus))
	entries := map[string]bool{}
	for _, e := range corpus.Entries {
		entries[e.ID] = true
	}
	pages := map[string]bool{}
	for _, page := range result.Pages {
		id := page.Id.String()
		if page.Id == uuid.Nil || pages[id] || len(page.Title) > 200 || len(page.Aliases) > 50 || page.Aliases == nil {
			return errors.New("invalid or duplicate wiki page")
		}
		switch page.Kind {
		case "person", "place", "project", "subject":
		default:
			return errors.New("invalid wiki page kind")
		}
		pages[id] = true
	}
	if len(result.Entries) != len(entries) {
		return errors.New("curation must account for every completed entry")
	}
	for _, entry := range result.Entries {
		id := entry.EntryId.String()
		if !entries[id] {
			return errors.New("unknown or duplicate curated entry")
		}
		delete(entries, id)
		if err := validateJournalSummaryEvidence(JournalSummaryResult{Title: entry.Title, Blocks: entry.Blocks}, allowed); err != nil {
			return err
		}
		// An entry analysis must describe the entry itself, not only other dates.
		cited := false
		for _, block := range entry.Blocks {
			for _, citation := range block.Citations {
				if citation.EntryId == id {
					cited = true
				}
			}
		}
		if !cited {
			return errors.New("entry analysis does not cite its own recording")
		}
		if err := validateJournalWikiLinks(entry.Blocks, pages); err != nil {
			return err
		}
	}
	for _, page := range result.Pages {
		if err := validateJournalSummaryEvidence(JournalSummaryResult{Title: page.Title, Blocks: page.Blocks}, allowed); err != nil {
			return err
		}
		if err := validateJournalWikiLinks(page.Blocks, pages); err != nil {
			return err
		}
	}
	return nil
}

// Legacy summaries are also checked against live primary sources. Stopping
// hierarchy writes must not leave quotations from deleted recordings readable.
func filterJournalLegacyEvidence(records []JournalStoredRecord) []JournalStoredRecord {
	allowed := journalAllowedCitations(journalCorpusSources(journalCorpusFromRecords(records)))
	result := make([]JournalStoredRecord, 0, len(records))
	for _, record := range records {
		if record.Summary != nil && validateJournalCitationEvidence(summaryCitations(*record.Summary), allowed) != nil {
			continue
		}
		if record.Entry != nil && record.Entry.Summary != nil && validateJournalCitationEvidence(summaryCitations(*record.Entry.Summary), allowed) != nil {
			entry := *record.Entry
			entry.Summary = nil
			record.Entry = &entry
		}
		result = append(result, record)
	}
	return result
}

func applyJournalGeneration(records []JournalStoredRecord, generation journalGeneration) []JournalStoredRecord {
	analyses := map[string]JournalCuratedEntry{}
	for _, analysis := range generation.Result.Entries {
		analyses[analysis.EntryId.String()] = analysis
	}
	result := filterJournalLegacyEvidence(records)
	for i, record := range result {
		if record.Entry == nil {
			continue
		}
		if analysis, ok := analyses[record.Entry.Id]; ok {
			entry := *record.Entry
			entry.Summary = ptr(summaryRecord("entry:"+entry.Id, JournalSummaryPeriodEntry, entry.RecordedAt, entry.RecordedAt.Add(time.Duration(entry.DurationMs)*time.Millisecond), JournalSummaryResult{Title: analysis.Title, Blocks: analysis.Blocks}, generation.Sources[entry.Id]))
			result[i].Entry = &entry
		}
	}
	return result
}

func (s *Server) GetJournalWikiPageId(ctx context.Context, request GetJournalWikiPageIdRequestObject) (GetJournalWikiPageIdResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	records, err := s.listJournalRecords(ctx, subject)
	if err != nil {
		return nil, err
	}
	generation, _, err := s.journalPublishedGeneration(ctx, records)
	if err != nil {
		return nil, err
	}
	for _, page := range generation.Result.Pages {
		if page.Id == request.PageId {
			return GetJournalWikiPageId200JSONResponse(page), nil
		}
	}
	return GetJournalWikiPageId404JSONResponse{Cause: "Wiki page unavailable or awaiting an update."}, nil
}

// RefreshJournalKnowledge advances one durable run without holding a Lambda
// open for the cloud agent. A five-minute schedule reconciles work; new paid
// runs start at most hourly. Conditional state versions fence concurrent calls.
func (s *Server) RefreshJournalKnowledge(ctx context.Context, now time.Time) error {
	if s.journalCurator == nil {
		return errors.New("journal curator is not configured")
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		return err
	}
	if now.Before(state.LeaseUntil) {
		return nil
	}
	state.LeaseUntil = now.Add(3 * time.Minute)
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		var conflict *types.ConditionalCheckFailedException
		if errors.As(err, &conflict) {
			return nil
		}
		return err
	}
	// Persist the latest state even on a retryable transport failure. Error
	// details stay out of diary data because provider errors can contain text.
	err = s.advanceJournalCuration(ctx, &state, now)
	state.LeaseUntil = time.Time{}
	saveErr := s.saveJournalCurationState(ctx, &state)
	return errors.Join(err, saveErr)
}

func (s *Server) advanceJournalCuration(ctx context.Context, state *journalCurationState, now time.Time) error {
	if state.Cleaning {
		// A damaged checkpoint must never turn temporary-file cleanup into
		// deletion of an original recording or another run's artifacts.
		if state.InputKey != "" {
			runID, err := uuid.Parse(state.RunID)
			if err != nil || runID == uuid.Nil || runID.String() != state.RunID || state.InputKey != journalCurationInputKey(state.RunID) {
				return errors.New("refusing to clean an unexpected journal input key")
			}
		}
		if err := s.journalCurator.Cleanup(ctx, state.RunID, state.SessionID); err != nil {
			return err
		}
		if state.InputKey != "" {
			if _, err := s.journalObjects.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.journalBucketName), Key: aws.String(state.InputKey)}); err != nil {
				return err
			}
		}
		state.RunID, state.SessionID, state.InputKey = "", "", ""
		state.Submitted, state.Cleaning = false, false
		return nil
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		return err
	}
	corpus := journalCorpusFromRecords(filterJournalLegacyEvidence(records))
	hashes, fingerprint := journalCorpusHashes(corpus)
	if state.RunID == "" {
		if len(corpus.Entries) == 0 || fingerprint == state.PublishedFingerprint || now.Before(state.StartedAt.Add(time.Hour)) {
			return nil
		}
		generation, _, err := s.journalPublishedGeneration(ctx, records)
		if err != nil {
			return err
		}
		corpus.Previous = generation.Result
		schema, err := structuredOutputSchema[JournalCurationResult]()
		if err != nil {
			return err
		}
		corpus.OutputSchema = schema
		data, err := json.Marshal(corpus)
		if err != nil {
			return err
		}
		// Inline files are split below the documented per-file and request limits.
		// Refuse an oversized corpus explicitly; never curate a truncated history.
		if len(data) > journalCurationMaxBytes {
			return errors.New("journal corpus exceeds document capacity")
		}
		if _, err := compressJournalCorpus(data); err != nil {
			return err
		}
		state.RunID = uuid.NewString()
		state.StartedAt, state.Fingerprint, state.Failed = now, fingerprint, false
		state.InputKey = journalCurationInputKey(state.RunID)
		if err := s.putJournalJSON(ctx, state.InputKey, corpus); err != nil {
			state.RunID = ""
			return err
		}
		if err := s.saveJournalCurationState(ctx, state); err != nil {
			return err
		}
	}
	// Deletion, date correction or another upload must not be overwritten by
	// an agent that worked on an older snapshot.
	if state.Fingerprint != fingerprint || now.After(state.StartedAt.Add(2*time.Hour)) {
		state.Cleaning, state.Failed = true, true
		return nil
	}
	if state.SessionID == "" {
		var snapshot journalCorpus
		if err := s.readJournalCurationJSON(ctx, state.InputKey, &snapshot); err != nil {
			return err
		}
		data, err := json.Marshal(snapshot)
		if err != nil {
			return err
		}
		sessionID, err := s.journalCurator.Prepare(ctx, state.RunID, data)
		if err != nil {
			return err
		}
		state.SessionID = sessionID
		// Persist identity before sending input. Start uses a durable idempotency
		// key, so a lost response cannot start a second paid turn.
		if err := s.saveJournalCurationState(ctx, state); err != nil {
			return err
		}
	}
	if !state.Submitted {
		if err := s.journalCurator.Start(ctx, state.SessionID, state.RunID); err != nil {
			return err
		}
		state.Submitted = true
		return nil
	}
	result, err := s.journalCurator.Collect(ctx, state.SessionID)
	if err != nil {
		var terminal *journalCuratorTerminalError
		if errors.As(err, &terminal) {
			state.Cleaning, state.Failed = true, true
		}
		return err
	}
	if result == nil {
		return nil
	}
	if err := validateJournalCuration(*result, corpus); err != nil {
		state.Cleaning, state.Failed = true, true
		return fmt.Errorf("invalid journal curation: %w", err)
	}
	key := "curation/generations/" + state.RunID + ".json"
	if err := s.putJournalJSON(ctx, key, journalGeneration{Sources: hashes, Result: *result}); err != nil {
		return err
	}
	// Recheck after artifact validation. Readers also compare the immutable
	// source hashes, covering source changes racing this pointer update.
	records, err = s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		return err
	}
	_, current := journalCorpusHashes(journalCorpusFromRecords(records))
	if current != state.Fingerprint {
		state.Cleaning = true
		return nil
	}
	state.PublishedKey, state.PublishedFingerprint, state.PublishedAt = key, fingerprint, now
	state.Cleaning, state.Failed = true, false
	return nil
}
