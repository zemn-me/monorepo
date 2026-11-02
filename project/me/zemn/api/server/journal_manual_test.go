package apiserver

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestJournalManualRunBypassesScheduleWithoutResettingBudget(t *testing.T) {
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	_, fingerprint := journalCorpusHashes(journalCorpusFromRecords([]JournalStoredRecord{{Entry: &entries[0]}, {Entry: &entries[1]}}))
	window := now.Add(-2 * time.Hour)
	state := journalCurationState{ID: journalOwnerSubject, When: journalCurationKey, Attempts: 3, AttemptWindowStart: window, StartedAt: now.Add(-time.Minute), PublishedFingerprint: fingerprint, Failed: true}
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
	first, second := uuid.NewString(), uuid.NewString()
	if err := s.RunJournalCuration(ctx, now, first); err != nil {
		t.Fatal(err)
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil || state.RunID == "" || !state.LastRunManual || state.ManualRequestID != first || state.Attempts != 3 || !state.AttemptWindowStart.Equal(window) || curator.starts != 1 {
		t.Fatalf("manual admission changed scheduled budget: %#v %v", state, err)
	}
	claimed, err := s.journalManualRequestRun(ctx, first)
	if err != nil || claimed != state.RunID {
		t.Fatalf("missing request binding: %s %v", claimed, err)
	}
	// Replays during work and a different concurrent request must not start work.
	if err := s.RunJournalCuration(ctx, now.Add(time.Minute), first); err != nil {
		t.Fatal(err)
	}
	if err := s.RunJournalCuration(ctx, now.Add(time.Minute), second); err == nil {
		t.Fatal("manual run replaced active work")
	}
	if curator.starts != 1 {
		t.Fatal("duplicate paid start")
	}
	result := journalKnowledgeResult(entries)
	curator.result = &result
	for _, minutes := range []int{5, 10} {
		if err := s.RefreshJournalKnowledge(ctx, now.Add(time.Duration(minutes)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.RunJournalCuration(ctx, now.Add(15*time.Minute), first); err != nil {
		t.Fatal(err)
	}
	if curator.starts != 1 {
		t.Fatal("cleaned request replay restarted work")
	}
	// A new explicit UUID permits a new test even with unchanged published input.
	if err := s.RunJournalCuration(ctx, now.Add(20*time.Minute), second); err != nil {
		t.Fatal(err)
	}
	for _, minutes := range []int{25, 30} {
		if err := s.RefreshJournalKnowledge(ctx, now.Add(time.Duration(minutes)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.RunJournalCuration(ctx, now.Add(35*time.Minute), first); err != nil {
		t.Fatal(err)
	}
	state, err = s.readJournalCurationState(ctx)
	if err != nil || curator.starts != 2 || state.Attempts != 3 || !state.AttemptWindowStart.Equal(window) || state.PublishedKey == "" {
		t.Fatalf("old request replay or budget mutation: %#v starts=%d %v", state, curator.starts, err)
	}
}

func TestJournalManualRunRecoversLostStartResponse(t *testing.T) {
	s, curator, ctx, _, now := journalKnowledgeFixture(t)
	request := uuid.NewString()
	curator.startFailure = errors.New("lost response")
	if err := s.RunJournalCuration(ctx, now, request); err == nil {
		t.Fatal("missing lost-response error")
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil || state.RunID == "" || state.Submitted {
		t.Fatalf("lost run checkpoint: %#v %v", state, err)
	}
	// A replay must not create another run. The schedule recovers the submission.
	if err := s.RunJournalCuration(ctx, now.Add(time.Minute), request); err != nil {
		t.Fatal(err)
	}
	curator.startFailure = nil
	if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if curator.prepares != 1 || len(curator.submissions) != 2 || curator.submissions[0] != curator.submissions[1] {
		t.Fatalf("manual retry changed paid submission: %#v", curator)
	}
	state, err = s.readJournalCurationState(ctx)
	if err != nil || state.Attempts != 0 || !state.Submitted {
		t.Fatalf("manual test consumed daily attempt: %#v %v", state, err)
	}
}

func TestJournalManualRunDoesNotBecomeLegacyDailyAttempt(t *testing.T) {
	s, curator, ctx, _, now := journalKnowledgeFixture(t)
	if err := s.RunJournalCuration(ctx, now, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	curator.failure = &journalCuratorTerminalError{reason: "failed"}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err == nil {
		t.Fatal("missing manual failure")
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(10*time.Minute)); err != nil {
		t.Fatal(err)
	}
	curator.failure = nil
	at := now.Add(time.Hour)
	if err := s.RefreshJournalKnowledge(ctx, at); err != nil {
		t.Fatal(err)
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil || state.Attempts != 1 || !state.AttemptWindowStart.Equal(at) || state.LastRunManual {
		t.Fatalf("manual run counted as legacy scheduled attempt: %#v %v", state, err)
	}
}

func TestJournalManualRunRetainsDeadlineAndValidation(t *testing.T) {
	for _, outcome := range []string{"timeout", "invalid output"} {
		t.Run(outcome, func(t *testing.T) {
			s, curator, ctx, _, now := journalKnowledgeFixture(t)
			if err := s.RunJournalCuration(ctx, now, uuid.NewString()); err != nil {
				t.Fatal(err)
			}
			if outcome == "timeout" {
				if err := s.RefreshJournalKnowledge(ctx, now.Add(30*time.Minute)); err != nil {
					t.Fatal(err)
				}
			} else {
				curator.result = &JournalCurationResult{}
				if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err == nil {
					t.Fatal("manual run bypassed publication validation")
				}
				if err := s.RefreshJournalKnowledge(ctx, now.Add(10*time.Minute)); err != nil {
					t.Fatal(err)
				}
			}
			state, err := s.readJournalCurationState(ctx)
			if err != nil || !state.Failed || state.PublishedKey != "" || state.RunID != "" || state.Attempts != 0 || curator.cleans != 1 {
				t.Fatalf("manual failure bypassed limits: %#v %v", state, err)
			}
		})
	}
}

func TestJournalManualRunValidatesRequestAndLease(t *testing.T) {
	s, curator, ctx, _, now := journalKnowledgeFixture(t)
	for _, id := range []string{"", "not-a-uuid", uuid.Nil.String()} {
		if err := s.RunJournalCuration(ctx, now, id); err == nil {
			t.Fatalf("accepted request ID %q", id)
		}
	}
	state := journalCurationState{ID: journalOwnerSubject, When: journalCurationKey, LeaseUntil: now.Add(time.Minute)}
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
	request := uuid.NewString()
	if err := s.RunJournalCuration(ctx, now, request); err == nil {
		t.Fatal("ignored another coordinator's lease")
	}
	if run, err := s.journalManualRequestRun(ctx, request); err != nil || run != "" {
		t.Fatalf("busy request was consumed: %s %v", run, err)
	}
	if curator.starts != 0 {
		t.Fatal("validation or busy lease started paid work")
	}
}
