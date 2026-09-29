package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/google/uuid"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

// The local curator exercises the production snapshot/import path without
// sending development fixtures to an external model.
type localJournalCurator struct {
	mu      sync.Mutex
	results map[string]apiserver.JournalCurationResult
}

func (c *localJournalCurator) Prepare(_ context.Context, runID string, data []byte) (string, error) {
	var corpus struct {
		Entries []struct {
			ID         string                               `json:"id"`
			Transcript []apiserver.JournalTranscriptSegment `json:"transcript"`
			Summary    *apiserver.JournalSummary            `json:"summary"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(data, &corpus); err != nil {
		return "", err
	}
	result := apiserver.JournalCurationResult{Entries: []apiserver.JournalCuratedEntry{}, Pages: []apiserver.JournalWikiPage{}}
	pageID := uuid.MustParse("cc6010d8-69d2-4f88-a2da-aed75ca48198")
	citations := []apiserver.JournalCitation{}
	for _, entry := range corpus.Entries {
		if entry.Summary == nil {
			return "", errors.New("local wiki fixtures require entry summaries")
		}
		blocks := append([]apiserver.JournalSummaryBlock(nil), entry.Summary.Blocks...)
		for i, block := range blocks {
			blocks[i].Markdown = strings.ReplaceAll(block.Markdown, "Maya", "[Maya](/journal?wiki="+pageID.String()+")")
		}
		result.Entries = append(result.Entries, apiserver.JournalCuratedEntry{EntryId: uuid.MustParse(entry.ID), Title: entry.Summary.Title, Blocks: blocks})
		for _, segment := range entry.Transcript {
			if strings.Contains(segment.Text, "Maya") {
				citations = append(citations, apiserver.JournalCitation{EntryId: entry.ID, SegmentId: segment.Id, Quote: segment.Text})
				break
			}
		}
	}
	if len(citations) > 0 {
		blocks := []apiserver.JournalSummaryBlock{}
		for _, citation := range citations {
			blocks = append(blocks, apiserver.JournalSummaryBlock{Markdown: citation.Quote + "[^1]", Citations: []apiserver.JournalCitation{citation}})
		}
		result.Pages = append(result.Pages, apiserver.JournalWikiPage{Id: pageID, Title: "Maya", Kind: "person", Aliases: []string{}, Blocks: blocks})
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.results == nil {
		c.results = map[string]apiserver.JournalCurationResult{}
	}
	c.results[runID] = result
	return runID, nil
}
func (c *localJournalCurator) Start(context.Context, string, string) error { return nil }
func (c *localJournalCurator) Collect(_ context.Context, sessionID string) (*apiserver.JournalCurationResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	result, ok := c.results[sessionID]
	if !ok {
		return nil, errors.New("local curator session missing")
	}
	return &result, nil
}
func (c *localJournalCurator) Cleanup(_ context.Context, _ string, sessionID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.results, sessionID)
	return nil
}
