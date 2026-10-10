package apiserver

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type wikiReadDDB struct {
	DynamoDBClient
	allowed map[string]bool
	mu      sync.Mutex
	entries map[string]bool
	queries int
}

func (db *wikiReadDDB) GetItem(ctx context.Context, input *dynamodb.GetItemInput, options ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
	when := keyTableRecordWhen(input.Key)
	if id, entry := strings.CutPrefix(when, "ENTRY#"); entry {
		if !db.allowed[id] {
			return nil, fmt.Errorf("wiki read unrelated recording %s", id)
		}
		if input.ProjectionExpression == nil || !strings.Contains(*input.ProjectionExpression, "#entry.#transcript") {
			return nil, fmt.Errorf("wiki did not project citation evidence")
		}
		db.mu.Lock()
		db.entries[id] = true
		db.mu.Unlock()
	}
	return db.DynamoDBClient.GetItem(ctx, input, options...)
}

func (db *wikiReadDDB) Query(ctx context.Context, input *dynamodb.QueryInput, options ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	if input.ProjectionExpression == nil || strings.Contains(*input.ProjectionExpression, "transcript") || strings.Contains(*input.ProjectionExpression, "summary") || strings.Contains(*input.ProjectionExpression, "audio") {
		return nil, fmt.Errorf("wiki or upload status read full journal content")
	}
	if input.KeyConditionExpression == nil || !strings.Contains(*input.KeyConditionExpression, "begins_with") {
		return nil, fmt.Errorf("metadata read included non-recording journal records")
	}
	db.queries++
	result, err := db.DynamoDBClient.Query(ctx, input, options...)
	if err != nil {
		return nil, err
	}
	// Apply the requested projection, which the shared in-memory DB omits.
	items := []map[string]types.AttributeValue{}
	for _, item := range result.Items {
		entry, ok := item["entry"].(*types.AttributeValueMemberM)
		if !ok {
			continue
		}
		metadata := map[string]types.AttributeValue{}
		for _, path := range strings.Split(*input.ProjectionExpression, ",") {
			_, name, _ := strings.Cut(strings.TrimSpace(path), ".")
			if resolved, ok := input.ExpressionAttributeNames[name]; ok {
				name = resolved
			}
			if value, ok := entry.Value[name]; ok {
				metadata[name] = value
			}
		}
		items = append(items, map[string]types.AttributeValue{"entry": &types.AttributeValueMemberM{Value: metadata}})
		if input.Limit != nil && len(items) == int(*input.Limit) {
			break
		}
	}
	return &dynamodb.QueryOutput{Items: items}, nil
}

type wikiReadObjects struct {
	JournalObjectStore
	forbidden string
	reads     []string
}

func (objects *wikiReadObjects) GetObject(ctx context.Context, input *s3.GetObjectInput, options ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if *input.Key == objects.forbidden {
		return nil, fmt.Errorf("wiki read the full curated generation")
	}
	objects.reads = append(objects.reads, *input.Key)
	return objects.JournalObjectStore.GetObject(ctx, input, options...)
}

func publishedWikiFixture(t *testing.T) (*Server, context.Context, []JournalStoredEntry, JournalCurationResult) {
	t.Helper()
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	result := journalKnowledgeResult(entries)
	result.Pages = append(result.Pages, JournalWikiPage{
		Id: uuid.New(), Title: "Moving", Kind: "subject", Aliases: []string{},
		Blocks: []JournalSummaryBlock{{Markdown: "A later account.[^1]", Citations: []JournalCitation{{EntryId: entries[1].Id, SegmentId: "s0", Quote: entries[1].Transcript[0].Text}}}},
	})
	curator.result = &result
	for i := range 3 {
		if err := s.RefreshJournalKnowledge(ctx, now.Add(time.Duration(i)*5*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	return s, ctx, entries, result
}

func TestWikiReadsOnlyRequestedContentAndCitedRecordings(t *testing.T) {
	s, ctx, entries, result := publishedWikiFixture(t)
	unrelated := entries[0]
	unrelated.Id = uuid.NewString()
	unrelated.Transcript = []JournalTranscriptSegment{{Id: "unrelated", Text: strings.Repeat("not part of the wiki ", 10000)}}
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, unrelated); err != nil {
		t.Fatal(err)
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.PublishedWikiKey == "" {
		t.Fatal("publication did not save separate wiki artifacts")
	}
	db := &wikiReadDDB{DynamoDBClient: s.ddb, allowed: map[string]bool{entries[0].Id: true, entries[1].Id: true}, entries: map[string]bool{}}
	objects := &wikiReadObjects{JournalObjectStore: s.journalObjects, forbidden: state.PublishedKey}
	s.ddb, s.journalObjects = db, objects
	indexResponse, err := s.GetJournalWiki(ctx, GetJournalWikiRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	index := indexResponse.(GetJournalWiki200JSONResponse)
	if len(index.Pages) != 2 || !index.HasEntries || index.Curation == nil || index.Curation.Generation == nil {
		t.Fatalf("wiki index = %#v", index)
	}
	if !reflect.DeepEqual(objects.reads, []string{state.PublishedWikiKey + "/index.json"}) {
		t.Fatalf("index read unrelated content: %v", objects.reads)
	}
	objects.reads = nil
	db.entries = map[string]bool{}
	pageResponse, err := s.GetJournalWikiPageId(ctx, GetJournalWikiPageIdRequestObject{PageId: result.Pages[1].Id})
	if err != nil {
		t.Fatal(err)
	}
	page := pageResponse.(GetJournalWikiPageId200JSONResponse)
	if len(page.Sources) != 1 || page.Sources[0].EntryId != entries[1].Id || !page.Sources[0].RecordedAt.Equal(entries[1].RecordedAt) || page.Sources[0].TimeZone != entries[1].TimeZone || page.Sources[0].StartMs != 0 || page.Sources[0].Title != "The move" {
		t.Fatalf("citation metadata = %#v", page.Sources)
	}
	if !reflect.DeepEqual(db.entries, map[string]bool{entries[1].Id: true}) {
		t.Fatalf("page read uncited recordings: %v", db.entries)
	}
	if !reflect.DeepEqual(objects.reads, []string{state.PublishedWikiKey + "/" + result.Pages[1].Id.String() + ".json"}) {
		t.Fatalf("page read unrelated wiki content: %v", objects.reads)
	}
}

func TestWikiReadsPreserveEvidenceFilteringAndCorrectedSourceDates(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		for _, mutation := range []string{"date", "transcript", "deleted"} {
			t.Run(fmt.Sprintf("legacy=%v/%s", legacy, mutation), func(t *testing.T) {
				s, ctx, entries, result := publishedWikiFixture(t)
				if legacy {
					state, err := s.readJournalCurationState(ctx)
					if err != nil {
						t.Fatal(err)
					}
					state.PublishedWikiKey = ""
					if err := s.saveJournalCurationState(ctx, &state); err != nil {
						t.Fatal(err)
					}
				}
				changed := entries[0]
				switch mutation {
				case "date":
					changed.RecordedAt = changed.RecordedAt.Add(-72 * time.Hour)
					if err := s.updateJournalEntry(ctx, journalOwnerSubject, changed); err != nil {
						t.Fatal(err)
					}
				case "transcript":
					changed.Transcript = []JournalTranscriptSegment{{Id: "s0", Text: "Changed primary evidence."}}
					if err := s.updateJournalEntry(ctx, journalOwnerSubject, changed); err != nil {
						t.Fatal(err)
					}
				case "deleted":
					if _, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: &s.journalTableName, Key: map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: journalOwnerSubject}, "when": &types.AttributeValueMemberS{Value: journalEntryRecordKey(changed.Id)}}}); err != nil {
						t.Fatal(err)
					}
				}
				canonicalResponse, err := s.GetJournal(ctx, GetJournalRequestObject{})
				if err != nil {
					t.Fatal(err)
				}
				canonical := canonicalResponse.(GetJournal200JSONResponse)
				indexResponse, err := s.GetJournalWiki(ctx, GetJournalWikiRequestObject{})
				if err != nil {
					t.Fatal(err)
				}
				index := indexResponse.(GetJournalWiki200JSONResponse)
				if !reflect.DeepEqual(index.Pages, *canonical.Wiki) {
					t.Fatalf("wiki index diverged from canonical evidence filtering: %#v %#v", index.Pages, canonical.Wiki)
				}
				pageResponse, err := s.GetJournalWikiPageId(ctx, GetJournalWikiPageIdRequestObject{PageId: result.Pages[0].Id})
				if err != nil {
					t.Fatal(err)
				}
				if mutation != "date" {
					if _, missing := pageResponse.(GetJournalWikiPageId404JSONResponse); !missing {
						t.Fatal("wiki served changed or deleted primary evidence")
					}
					return
				}
				page := pageResponse.(GetJournalWikiPageId200JSONResponse)
				if !reflect.DeepEqual(page.Blocks, result.Pages[0].Blocks) {
					t.Fatal("recording metadata edits removed published prose")
				}
				for _, source := range page.Sources {
					if source.EntryId == changed.Id && !source.RecordedAt.Equal(changed.RecordedAt) {
						t.Fatal("citation retained the old recording date")
					}
				}
			})
		}
	}
}

func TestJournalUploadStatusOmitsTranscriptSummaryAndAudio(t *testing.T) {
	s, ctx, entries, _ := publishedWikiFixture(t)
	entry := entries[0]
	entry.ContentSha256 = strings.Repeat("a", 64)
	entry.ByteLength = 123
	entry.Status = JournalEntryStatusProcessing
	entry.ProcessingProgress = &JournalProcessingProgress{Stage: JournalProcessingProgressStageTranscribing}
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, entry); err != nil {
		t.Fatal(err)
	}
	s.ddb = &wikiReadDDB{DynamoDBClient: s.ddb, allowed: map[string]bool{}, entries: map[string]bool{}}
	response, err := s.GetJournalEntries(ctx, GetJournalEntriesRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	metadata := response.(GetJournalEntries200JSONResponse)
	if len(metadata.Entries) != 2 {
		t.Fatalf("upload metadata = %#v", metadata)
	}
	for _, value := range metadata.Entries {
		if len(value.Transcript) != 0 || value.Summary != nil || value.AudioUrl != nil {
			t.Fatal("upload metadata included journal content")
		}
		if value.Id.String() == entry.Id && (value.ContentSha256 != entry.ContentSha256 || value.ByteLength != entry.ByteLength || value.ProcessingProgress == nil || value.Status != "processing") {
			t.Fatal("upload metadata lost confirmation or processing progress")
		}
	}
}

type wikiWriteFailureObjects struct{ JournalObjectStore }

func (objects wikiWriteFailureObjects) PutObject(ctx context.Context, input *s3.PutObjectInput, options ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if strings.HasSuffix(*input.Key, "/wiki/index.json") {
		return nil, fmt.Errorf("wiki index write failed")
	}
	return objects.JournalObjectStore.PutObject(ctx, input, options...)
}

func TestWikiArtifactFailureDoesNotPublishPartialGeneration(t *testing.T) {
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	result := journalKnowledgeResult(entries)
	s.journalObjects = wikiWriteFailureObjects{JournalObjectStore: s.journalObjects}
	for i := range 2 {
		if err := s.RefreshJournalKnowledge(ctx, now.Add(time.Duration(i)*5*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	curator.result = &result
	if err := s.RefreshJournalKnowledge(ctx, now.Add(10*time.Minute)); err == nil || !strings.Contains(err.Error(), "wiki index write failed") {
		t.Fatalf("publication failure = %v", err)
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.PublishedKey != "" || state.PublishedWikiKey != "" {
		t.Fatalf("partial artifacts became visible: %#v", state)
	}
}
