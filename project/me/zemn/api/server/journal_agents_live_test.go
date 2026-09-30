package apiserver

import (
	"context"
	"os"
	"testing"
	"time"
)

// Opt in explicitly when checking the hosted service. Only synthetic diary
// entries are uploaded; normal CI never needs a paid service or credentials.
func TestJournalAgentsLiveSyntheticSchema(t *testing.T) {
	key := os.Getenv("JOURNAL_DIAGNOSTIC_API_KEY")
	if key == "" {
		t.Skip("set JOURNAL_DIAGNOSTIC_API_KEY to run the paid synthetic integration")
	}
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	for i, text := range []string{
		"I met Mira at Cedar Hall to plan our Lantern project. We agreed that a decision log should record decisions and reasons throughout the project.",
		"Mira and I returned to Cedar Hall to work on Lantern. Our decision log helped us remember why we chose a small prototype before a public launch.",
	} {
		entries[i].Transcript[0].Text = text
		if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[i]); err != nil {
			t.Fatal(err)
		}
	}
	curator := &openAIJournalCurator{ai: newOpenAIJournalAI(key).(*openAIJournalAI), model: "gpt-6-astra"}
	s.journalCurator = curator
	liveCtx, cancel := context.WithTimeout(ctx, 8*time.Minute)
	defer cancel()
	defer func() {
		state, err := s.readJournalCurationState(ctx)
		if err != nil {
			t.Error(err)
			return
		}
		if state.RunID == "" {
			return
		}
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), time.Minute)
		defer cleanupCancel()
		for cleanupCtx.Err() == nil {
			if err := curator.Cleanup(cleanupCtx, state.RunID, state.SessionID); err == nil {
				return
			}
			time.Sleep(5 * time.Second)
		}
		t.Error("synthetic hosted session cleanup failed")
	}()
	started := time.Now()
	for liveCtx.Err() == nil {
		if err := s.RefreshJournalKnowledge(liveCtx, now.Add(time.Since(started))); err != nil {
			t.Fatal(err)
		}
		state, err := s.readJournalCurationState(liveCtx)
		if err != nil {
			t.Fatal(err)
		}
		if state.Failed {
			t.Fatal("synthetic curation failed")
		}
		if !state.PublishedAt.IsZero() {
			response, err := s.GetJournal(liveCtx, GetJournalRequestObject{})
			if err != nil {
				t.Fatal(err)
			}
			journal := response.(GetJournal200JSONResponse)
			if journal.Curation.Status != "ready" || journal.Wiki == nil || len(*journal.Wiki) == 0 || len(journal.Entries) != len(entries) {
				t.Fatal("generation was not published to the journal API")
			}
			for _, entry := range journal.Entries {
				if entry.Summary == nil {
					t.Fatal("published entry lacks an analysis")
				}
			}
			t.Logf("hosted generation validated and published: %d entries, %d pages", len(journal.Entries), len(*journal.Wiki))
			return
		}
		time.Sleep(5 * time.Second)
	}
	t.Fatal(liveCtx.Err())
}
