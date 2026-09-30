package apiserver

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/xeipuuv/gojsonschema"
)

func TestJournalCurationContract(t *testing.T) {
	_, _, _, entries, _ := journalKnowledgeFixture(t)
	corpus := journalCorpusFromRecords([]JournalStoredRecord{{Entry: &entries[0]}, {Entry: &entries[1]}})
	for _, kind := range []JournalWikiPageKind{"person", "place", "project", "subject"} {
		result := journalKnowledgeResult(entries)
		result.Pages[0].Kind = kind
		result.Pages[0].Title = strings.Repeat("é", 200)
		if err := validateJournalCuration(result, corpus); err != nil {
			t.Fatalf("valid category and Unicode title rejected: %v", err)
		}
	}
	for _, tc := range []struct {
		name   string
		mutate func(*JournalCurationResult)
	}{
		{"invented category", func(r *JournalCurationResult) { r.Pages[0].Kind = "private invented category" }},
		{"long title", func(r *JournalCurationResult) { r.Pages[0].Title = strings.Repeat("é", 201) }},
		{"too many aliases", func(r *JournalCurationResult) { r.Pages[0].Aliases = make([]string, 51) }},
		{"null aliases", func(r *JournalCurationResult) { r.Pages[0].Aliases = nil }},
		{"null entries", func(r *JournalCurationResult) { r.Entries = nil }},
		{"null pages", func(r *JournalCurationResult) { r.Pages = nil }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := journalKnowledgeResult(entries)
			tc.mutate(&result)
			if err := validateJournalCuration(result, corpus); err == nil || strings.Contains(err.Error(), "private invented category") {
				t.Fatal("invalid output accepted or private value disclosed")
			}
		})
	}
}

func TestJournalCurationExportedSchemaRejectsMalformedArtifacts(t *testing.T) {
	_, _, _, entries, _ := journalKnowledgeFixture(t)
	schema, err := journalCurationValidator()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		mutate func(map[string]any)
	}{
		{"array entry UUID", func(r map[string]any) { r["entries"].([]any)[0].(map[string]any)["entryId"] = []int{1, 2, 3} }},
		{"invalid page UUID", func(r map[string]any) { r["pages"].([]any)[0].(map[string]any)["id"] = "not-a-uuid" }},
		{"missing kind", func(r map[string]any) { delete(r["pages"].([]any)[0].(map[string]any), "kind") }},
		{"unknown field", func(r map[string]any) { r["pages"].([]any)[0].(map[string]any)["sourceEdits"] = []any{} }},
		{"missing citation quote", func(r map[string]any) {
			delete(r["pages"].([]any)[0].(map[string]any)["blocks"].([]any)[0].(map[string]any)["citations"].([]any)[0].(map[string]any), "quote")
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(journalKnowledgeResult(entries))
			if err != nil {
				t.Fatal(err)
			}
			var result map[string]any
			if err := json.Unmarshal(data, &result); err != nil {
				t.Fatal(err)
			}
			tc.mutate(result)
			validation, err := schema.Validate(gojsonschema.NewGoLoader(result))
			if err != nil {
				t.Fatal(err)
			}
			if validation.Valid() {
				t.Fatal("malformed artifact accepted")
			}
		})
	}
}
