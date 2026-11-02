package apiserver

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"golang.org/x/sync/errgroup"
)

type journalWikiEvidence struct {
	EntryID   string `json:"entryId"`
	SegmentID string `json:"segmentId"`
	QuoteHash string `json:"quoteHash"`
}

type journalWikiIndexPage struct {
	Page   JournalWikiIndexEntry   `json:"page"`
	Blocks [][]journalWikiEvidence `json:"blocks"`
}

type journalWikiIndexDocument struct {
	Pages []journalWikiIndexPage `json:"pages"`
}

type journalWikiPageDocument struct {
	Page   JournalWikiPage   `json:"page"`
	Titles map[string]string `json:"titles"`
}

func wikiEvidence(citation JournalCitation) journalWikiEvidence {
	return journalWikiEvidence{EntryID: citation.EntryId, SegmentID: citation.SegmentId, QuoteHash: fmt.Sprintf("%x", sha256.Sum256([]byte(citation.Quote)))}
}

func wikiIndexDocument(result JournalCurationResult) journalWikiIndexDocument {
	index := journalWikiIndexDocument{Pages: []journalWikiIndexPage{}}
	for _, page := range result.Pages {
		item := journalWikiIndexPage{Page: JournalWikiIndexEntry{Id: page.Id, Title: page.Title, Kind: string(page.Kind), Aliases: page.Aliases}, Blocks: [][]journalWikiEvidence{}}
		for _, block := range page.Blocks {
			evidence := []journalWikiEvidence{}
			for _, citation := range block.Citations {
				evidence = append(evidence, wikiEvidence(citation))
			}
			item.Blocks = append(item.Blocks, evidence)
		}
		index.Pages = append(index.Pages, item)
	}
	return index
}

func wikiPageDocument(page JournalWikiPage, result JournalCurationResult) journalWikiPageDocument {
	document := journalWikiPageDocument{Page: page, Titles: map[string]string{}}
	cited := map[string]bool{}
	for _, block := range page.Blocks {
		for _, citation := range block.Citations {
			cited[citation.EntryId] = true
		}
	}
	for _, entry := range result.Entries {
		if id := entry.EntryId.String(); cited[id] {
			document.Titles[id] = entry.Title
		}
	}
	return document
}

func (s *Server) writeJournalWikiGeneration(ctx context.Context, generationKey string, result JournalCurationResult) (string, error) {
	prefix := strings.TrimSuffix(generationKey, ".json") + "/wiki"
	for _, page := range result.Pages {
		if err := s.putJournalJSON(ctx, prefix+"/"+page.Id.String()+".json", wikiPageDocument(page, result)); err != nil {
			return "", err
		}
	}
	if err := s.putJournalJSON(ctx, prefix+"/index.json", wikiIndexDocument(result)); err != nil {
		return "", err
	}
	return prefix, nil
}

func (s *Server) readJournalWikiIndex(ctx context.Context, state journalCurationState) (journalWikiIndexDocument, error) {
	index := journalWikiIndexDocument{Pages: []journalWikiIndexPage{}}
	if state.PublishedWikiKey != "" {
		err := s.readJournalCurationJSON(ctx, state.PublishedWikiKey+"/index.json", &index)
		return index, err
	}
	// Existing publications remain readable until the next generation publishes
	// separate wiki artifacts. Neither path reads the complete recording feed.
	if state.PublishedKey != "" {
		var generation journalGeneration
		if err := s.readJournalCurationJSON(ctx, state.PublishedKey, &generation); err != nil {
			return index, err
		}
		index = wikiIndexDocument(generation.Result)
	}
	return index, nil
}

func (s *Server) readJournalWikiPage(ctx context.Context, state journalCurationState, pageID string) (journalWikiPageDocument, bool, error) {
	var document journalWikiPageDocument
	if state.PublishedWikiKey != "" {
		err := s.readJournalCurationJSON(ctx, state.PublishedWikiKey+"/"+pageID+".json", &document)
		var missing *s3types.NoSuchKey
		if errors.As(err, &missing) || errors.Is(err, io.EOF) {
			return document, false, nil
		}
		return document, err == nil, err
	}
	if state.PublishedKey != "" {
		var generation journalGeneration
		if err := s.readJournalCurationJSON(ctx, state.PublishedKey, &generation); err != nil {
			return document, false, err
		}
		for _, page := range generation.Result.Pages {
			if page.Id.String() == pageID {
				return wikiPageDocument(page, generation.Result), true, nil
			}
		}
	}
	return document, false, nil
}

// Read only recordings cited by the requested wiki content. Primary evidence is
// checked on every read so deletion or transcription changes remove stale blocks.
func (s *Server) journalWikiRecords(ctx context.Context, subject string, ids map[string]bool) ([]JournalStoredRecord, error) {
	ordered := make([]string, 0, len(ids))
	for id := range ids {
		ordered = append(ordered, id)
	}
	sort.Strings(ordered)
	records := make([]JournalStoredRecord, len(ordered))
	group, readContext := errgroup.WithContext(ctx)
	group.SetLimit(8)
	for i, id := range ordered {
		if readContext.Err() != nil {
			break
		}
		group.Go(func() error {
			result, err := s.ddb.GetItem(readContext, &dynamodb.GetItemInput{
				TableName: aws.String(s.journalTableName), ConsistentRead: aws.Bool(true),
				Key:                      map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: subject}, "when": &types.AttributeValueMemberS{Value: journalEntryRecordKey(id)}},
				ProjectionExpression:     aws.String("#entry.#id, #entry.#recorded, #entry.#zone, #entry.#status, #entry.#transcript, #entry.#title"),
				ExpressionAttributeNames: map[string]string{"#entry": "entry", "#id": "id", "#recorded": "recorded_at", "#zone": "time_zone", "#status": "status", "#transcript": "transcript", "#title": "title"},
			})
			if err != nil {
				return err
			}
			return attributevalue.UnmarshalMap(result.Item, &records[i])
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Server) GetJournalWiki(ctx context.Context, _ GetJournalWikiRequestObject) (GetJournalWikiResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		return nil, err
	}
	index, err := s.readJournalWikiIndex(ctx, state)
	if err != nil {
		return nil, err
	}
	ids := map[string]bool{}
	for _, page := range index.Pages {
		for _, block := range page.Blocks {
			for _, evidence := range block {
				ids[evidence.EntryID] = true
			}
		}
	}
	records, err := s.journalWikiRecords(ctx, subject, ids)
	if err != nil {
		return nil, err
	}
	allowed := map[journalWikiEvidence]bool{}
	for _, source := range journalCorpusSources(journalCorpusFromRecords(records)) {
		for _, citation := range source.Citations {
			allowed[wikiEvidence(citation)] = true
		}
	}
	pages := []JournalWikiIndexEntry{}
	for _, page := range index.Pages {
		for _, block := range page.Blocks {
			valid := true
			for _, evidence := range block {
				if !allowed[evidence] {
					valid = false
					break
				}
			}
			if valid {
				pages = append(pages, page.Page)
				break
			}
		}
	}
	sort.Slice(pages, func(i, j int) bool { return pages[i].Title < pages[j].Title })
	hasEntries, err := s.journalHasEntries(ctx, subject)
	if err != nil {
		return nil, err
	}
	response := GetJournalWiki200JSONResponse{Pages: pages, HasEntries: hasEntries}
	response.Curation = s.journalWikiCurationStatus(state)
	return response, nil
}

func (s *Server) journalWikiCurationStatus(state journalCurationState) *JournalCurationStatus {
	if s.journalCurationEnabled || state.Version != "" {
		status := JournalCurationStatus{Status: JournalCurationStatusStatusPending}
		if state.PublishedKey != "" && state.PublishedFingerprint == state.Fingerprint {
			status.Status = JournalCurationStatusStatusReady
		}
		if state.RunID != "" && !state.Cleaning {
			status.Status = JournalCurationStatusStatusRunning
		}
		if state.Failed {
			status.Status = JournalCurationStatusStatusFailed
		}
		if !state.PublishedAt.IsZero() {
			status.UpdatedAt = &state.PublishedAt
			status.Generation = &state.PublishedKey
		}
		return &status
	}
	return nil
}

func (s *Server) GetJournalWikiPageId(ctx context.Context, request GetJournalWikiPageIdRequestObject) (GetJournalWikiPageIdResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		return nil, err
	}
	document, found, err := s.readJournalWikiPage(ctx, state, request.PageId.String())
	if err != nil {
		return nil, err
	}
	if !found {
		return GetJournalWikiPageId404JSONResponse{Cause: "Wiki page unavailable or awaiting an update."}, nil
	}
	ids := map[string]bool{}
	for _, block := range document.Page.Blocks {
		for _, citation := range block.Citations {
			ids[citation.EntryId] = true
		}
	}
	records, err := s.journalWikiRecords(ctx, subject, ids)
	if err != nil {
		return nil, err
	}
	allowed := journalAllowedCitations(journalCorpusSources(journalCorpusFromRecords(records)))
	page := document.Page
	page.Blocks = filterJournalBlocks(page.Blocks, allowed)
	if len(page.Blocks) == 0 {
		return GetJournalWikiPageId404JSONResponse{Cause: "Wiki page unavailable or awaiting an update."}, nil
	}
	entries := map[string]JournalStoredEntry{}
	for _, record := range records {
		if record.Entry != nil {
			entries[record.Entry.Id] = *record.Entry
		}
	}
	sources := []JournalWikiSource{}
	seen := map[JournalCitation]bool{}
	for _, block := range page.Blocks {
		for _, citation := range block.Citations {
			if seen[citation] {
				continue
			}
			seen[citation] = true
			entry := entries[citation.EntryId]
			for _, segment := range entry.Transcript {
				if segment.Id != citation.SegmentId || segment.Text != citation.Quote {
					continue
				}
				title := document.Titles[entry.Id]
				if entry.Title != nil {
					title = *entry.Title
				}
				sources = append(sources, JournalWikiSource{EntryId: entry.Id, SegmentId: segment.Id, RecordedAt: entry.RecordedAt, TimeZone: entry.TimeZone, StartMs: segment.StartMs, Title: title})
				break
			}
		}
	}
	return GetJournalWikiPageId200JSONResponse{Id: page.Id, Title: page.Title, Kind: JournalWikiPageViewKind(page.Kind), Aliases: page.Aliases, Blocks: page.Blocks, Sources: sources, Curation: s.journalWikiCurationStatus(state)}, nil
}
