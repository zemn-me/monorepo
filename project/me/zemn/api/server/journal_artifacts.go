package apiserver

import (
	"bytes"
	"context"
	"io"
	"path"
	"strings"

	openai "github.com/openai/openai-go/v3"
)

const journalCuratorManifestPath = "/workspace/outputs/journal-manifest.json"
const journalCuratorPartsDirectory = "/workspace/outputs/journal-parts"
const journalCuratorManifestLimit = 128 * 1024
const journalCuratorMaxParts = 1024

type journalCuratorManifest struct {
	Parts []string `json:"parts"`
}

// The manifest commits one complete generation. Parts may have been produced in
// earlier turns, but drafts and abandoned revisions are never implicitly merged.
func (o *openAIJournalCurator) collectJournalParts(ctx context.Context, sessionID, turnID string, manifest openai.SessionArtifact, artifacts []openai.SessionArtifact) (*JournalCurationResult, error) {
	var listing journalCuratorManifest
	consumed, err := o.readJournalArtifact(ctx, sessionID, manifest, journalCuratorManifestLimit, &listing)
	if err != nil {
		return nil, err
	}
	if len(listing.Parts) == 0 || len(listing.Parts) > journalCuratorMaxParts {
		return nil, &journalCuratorTerminalError{reason: "invalid journal manifest part count"}
	}
	seen := map[string]bool{}
	result := &JournalCurationResult{Entries: []JournalCuratedEntry{}, Pages: []JournalWikiPage{}}
	for _, filename := range listing.Parts {
		if path.Dir(filename) != journalCuratorPartsDirectory || path.Clean(filename) != filename || !strings.HasSuffix(filename, ".json") || seen[filename] {
			return nil, &journalCuratorTerminalError{reason: "invalid or duplicate journal manifest part path"}
		}
		seen[filename] = true
		var selected *openai.SessionArtifact
		ambiguous := false
		for i := range artifacts {
			candidate := &artifacts[i]
			if candidate.Path != filename {
				continue
			}
			// Prefer the current turn's snapshot, otherwise the most recently published
			// version. Never rely on API pagination order or arbitrary artifact IDs.
			if selected == nil || (candidate.TurnID == turnID && selected.TurnID != turnID) || (candidate.TurnID != turnID && selected.TurnID != turnID && candidate.CreatedAt > selected.CreatedAt) {
				selected, ambiguous = candidate, false
			} else if candidate.ID != selected.ID && ((candidate.TurnID == turnID && selected.TurnID == turnID) || (candidate.TurnID != turnID && selected.TurnID != turnID && candidate.CreatedAt == selected.CreatedAt)) {
				ambiguous = true
			}
		}
		if selected == nil || ambiguous {
			return nil, &journalCuratorTerminalError{reason: "journal manifest part missing or version ambiguous"}
		}
		var part JournalCurationResult
		n, err := o.readJournalArtifact(ctx, sessionID, *selected, journalCurationMaxBytes-consumed, &part)
		if err != nil {
			return nil, err
		}
		consumed += n
		if err := validateJournalCurationSchema(part); err != nil {
			return nil, &journalCuratorTerminalError{reason: err.Error()}
		}
		result.Entries = append(result.Entries, part.Entries...)
		result.Pages = append(result.Pages, part.Pages...)
		result.DateCorrections = append(result.DateCorrections, part.DateCorrections...)
	}
	return result, nil
}

// Bound actual bytes as well as metadata, including the total across parts.
// Diagnostics report error categories rather than private output values.
func (o *openAIJournalCurator) readJournalArtifact(ctx context.Context, sessionID string, artifact openai.SessionArtifact, limit int64, target any) (int64, error) {
	if limit < 0 || artifact.SizeBytes > limit {
		return 0, &journalCuratorTerminalError{reason: "journal artifact exceeds size limit"}
	}
	sessions := o.sessions()
	response, err := sessions.Artifacts.Content(ctx, sessionID, artifact.ID)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return 0, err
	}
	if int64(len(data)) > limit {
		return 0, &journalCuratorTerminalError{reason: "journal artifact exceeds size limit"}
	}
	if err := decodeJournalCurationJSON(bytes.NewReader(data), target); err != nil {
		return 0, &journalCuratorTerminalError{reason: "journal agent returned malformed output: " + journalCurationDecodeDiagnostic(err)}
	}
	return int64(len(data)), nil
}

// A complete manifest takes precedence over the single-file form. Only an
// explicit manifest from the latest completed turn can commit accumulated parts.
func (o *openAIJournalCurator) collectJournalOutput(ctx context.Context, sessionID, turnID string) (*JournalCurationResult, error) {
	sessions := o.sessions()
	pages := sessions.Artifacts.ListAutoPaging(ctx, sessionID, openai.BetaAgentSessionArtifactListParams{Limit: openai.Int(100)})
	var artifacts []openai.SessionArtifact
	var manifest, single *openai.SessionArtifact
	for pages.Next() {
		artifact := pages.Current()
		artifacts = append(artifacts, artifact)
		if artifact.TurnID != turnID {
			continue
		}
		switch artifact.Path {
		case journalCuratorManifestPath:
			if manifest != nil {
				return nil, &journalCuratorTerminalError{reason: "duplicate journal manifest"}
			}
			snapshot := artifact
			manifest = &snapshot
		case journalCuratorOutputPath:
			snapshot := artifact
			single = &snapshot
		}
	}
	if err := pages.Err(); err != nil {
		return nil, err
	}
	if manifest != nil {
		return o.collectJournalParts(ctx, sessionID, turnID, *manifest, artifacts)
	}
	if single != nil {
		var result JournalCurationResult
		_, err := o.readJournalArtifact(ctx, sessionID, *single, journalCurationMaxBytes, &result)
		if err != nil {
			return nil, err
		}
		return &result, nil
	}
	return nil, nil
}
