package apiserver

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/google/uuid"
	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const journalMCPPath = "/journal/mcp"

// Consent accepts the website identity token and resolves current account scopes.
// Neither request headers nor unverified token claims select a signing key.
func (s *Server) verifyJournalIdentity(ctx context.Context, raw string, _ *http.Request) (*mcpauth.TokenInfo, error) {
	token, err := jwt.ParseSigned(raw, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return nil, mcpauth.ErrInvalidToken
	}
	var claims jwt.Claims
	if err := token.Claims(s.keySet().Keys[0].Key, &claims); err != nil {
		return nil, mcpauth.ErrInvalidToken
	}
	root, err := ApiRoot()
	if err != nil {
		return nil, errors.New("journal authentication unavailable")
	}
	if claims.Expiry == nil || claims.Subject == "" || claims.ValidateWithLeeway(jwt.Expected{
		Issuer: root.String(), AnyAudience: jwt.Audience{zemnMeClient}, Time: time.Now(),
	}, 0) != nil {
		return nil, mcpauth.ErrInvalidToken
	}
	scopes, err := s.resolveScopes(ctx, claims.Issuer, claims.Subject)
	if err != nil {
		return nil, errors.New("journal authentication unavailable")
	}
	return &mcpauth.TokenInfo{UserID: claims.Subject, Scopes: scopes, Expiration: claims.Expiry.Time()}, nil
}

func (s *Server) journalMCPHandler() http.Handler {
	server := mcp.NewServer(&mcp.Implementation{Name: "voice-diary", Version: "1.0.0"}, nil)
	annotations := &mcp.ToolAnnotations{ReadOnlyHint: true, OpenWorldHint: ptr(false)}
	mcp.AddTool(server, &mcp.Tool{
		Name: "search_journal", Description: "Search completed voice diary entries by text and recording time. An empty query lists entries, newest first. Use get_journal_entry for full transcripts and citations.", Annotations: annotations,
	}, s.searchJournalMCP)
	mcp.AddTool(server, &mcp.Tool{
		Name: "get_journal_entry", Description: "Read a completed voice diary entry's transcript and citation-preserving summary by entry ID.", Annotations: annotations,
	}, s.getJournalEntryMCP)
	mcp.AddTool(server, &mcp.Tool{
		Name: "list_journal_summaries", Description: "Read citation-preserving diary summaries for days, weeks, months, years, or the entire journal. Results are ordered newest first.", Annotations: annotations,
	}, s.listJournalSummariesMCP)
	transport := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{
		Stateless: true, JSONResponse: true,
		CrossOriginProtection: &http.CrossOriginProtection{},
	})
	owner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info := mcpauth.TokenInfoFromContext(r.Context())
		ctx := context.WithValue(r.Context(), auth.IDTokenKey, &auth.IDToken{Subject: info.UserID})
		if _, err := journalSubject(ctx); err != nil {
			http.Error(w, "the journal is restricted to its owner", http.StatusForbidden)
			return
		}
		http.MaxBytesHandler(transport, 64*1024).ServeHTTP(w, r.WithContext(ctx))
	})
	return mcpauth.RequireBearerToken(s.verifyJournalMCPToken, &mcpauth.RequireBearerTokenOptions{Scopes: []string{"journal_read"}, ResourceMetadataURL: oauthURL(oauthResourceMetadataPath)})(owner)
}

// Route outside OpenAPI's JSON validator: MCP owns its JSON-RPC framing and
// transport negotiation, while its middleware authenticates every request.
func (s *Server) withJournalMCP(next http.Handler) http.Handler {
	handler := s.journalMCPHandler()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == journalMCPPath {
			w.Header().Set("Cache-Control", "private, no-store")
			handler.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type journalMCPFilter struct {
	Query  string `json:"query,omitempty" jsonschema:"Case-insensitive substring to find in entry titles, transcripts, or summaries"`
	Start  string `json:"start,omitempty" jsonschema:"Inclusive recording time in RFC3339 format"`
	End    string `json:"end,omitempty" jsonschema:"Exclusive recording time in RFC3339 format"`
	Offset int    `json:"offset,omitempty" jsonschema:"Zero-based result offset; default 0"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Page size from 1 to 50; default 20"`
}

func (f journalMCPFilter) validate() (start, end time.Time, limit int, err error) {
	if len(f.Query) > 1000 || f.Offset < 0 || f.Limit < 0 || f.Limit > 50 {
		return start, end, 0, errors.New("query must be at most 1000 bytes, offset nonnegative, and limit between 1 and 50")
	}
	if f.Start != "" {
		start, err = time.Parse(time.RFC3339, f.Start)
		if err != nil {
			return start, end, 0, errors.New("start must be an RFC3339 timestamp")
		}
	}
	if f.End != "" {
		end, err = time.Parse(time.RFC3339, f.End)
		if err != nil {
			return start, end, 0, errors.New("end must be an RFC3339 timestamp")
		}
	}
	if !start.IsZero() && !end.IsZero() && !start.Before(end) {
		return start, end, 0, errors.New("start must be before end")
	}
	limit = f.Limit
	if limit == 0 {
		limit = 20
	}
	return
}

func journalMCPPage[T any](items []T, offset, limit int) ([]T, *int) {
	offset = min(offset, len(items))
	end := offset + min(limit, len(items)-offset)
	var next *int
	if end < len(items) {
		next = ptr(end)
	}
	return items[offset:end], next
}

func (s *Server) journalMCPRecords(ctx context.Context) ([]JournalStoredRecord, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	records, err := s.listJournalRecords(ctx, subject)
	if err != nil {
		return nil, errors.New("unable to read journal")
	}
	return records, nil
}

type journalMCPMatch struct {
	ID         string    `json:"id"`
	RecordedAt time.Time `json:"recordedAt"`
	Title      string    `json:"title"`
	Excerpt    string    `json:"excerpt"`
}

type journalMCPSearchResult struct {
	Entries    []journalMCPMatch `json:"entries"`
	NextOffset *int              `json:"next_offset,omitempty"`
}

func (s *Server) searchJournalMCP(ctx context.Context, _ *mcp.CallToolRequest, f journalMCPFilter) (*mcp.CallToolResult, journalMCPSearchResult, error) {
	result := journalMCPSearchResult{Entries: []journalMCPMatch{}}
	start, end, limit, err := f.validate()
	if err != nil {
		return nil, result, err
	}
	records, err := s.journalMCPRecords(ctx)
	if err != nil {
		return nil, result, err
	}
	query := strings.ToLower(f.Query)
	for _, record := range records {
		entry := record.Entry
		if entry == nil || entry.Status != JournalEntryStatusReady || (!start.IsZero() && entry.RecordedAt.Before(start)) || (!end.IsZero() && !entry.RecordedAt.Before(end)) {
			continue
		}
		var title string
		var parts []string
		if entry.Summary != nil {
			title = entry.Summary.Title
			parts = append(parts, title, summaryText(*entry.Summary))
		}
		for _, segment := range entry.Transcript {
			parts = append(parts, segment.Text)
		}
		text := strings.Join(parts, "\n")
		if !strings.Contains(strings.ToLower(text), query) {
			continue
		}
		excerpt := []rune(text)
		if len(excerpt) > 400 {
			excerpt = append(excerpt[:400], '…')
		}
		result.Entries = append(result.Entries, journalMCPMatch{ID: entry.Id, RecordedAt: entry.RecordedAt, Title: title, Excerpt: string(excerpt)})
	}
	sort.Slice(result.Entries, func(i, j int) bool {
		a, b := result.Entries[i], result.Entries[j]
		if a.RecordedAt.Equal(b.RecordedAt) {
			return a.ID < b.ID
		}
		return a.RecordedAt.After(b.RecordedAt)
	})
	result.Entries, result.NextOffset = journalMCPPage(result.Entries, f.Offset, limit)
	return nil, result, nil
}

type journalMCPEntryArgs struct {
	ID string `json:"id" jsonschema:"UUID returned by search_journal"`
}
type journalMCPEntry struct {
	ID         string                     `json:"id"`
	RecordedAt time.Time                  `json:"recordedAt"`
	TimeZone   string                     `json:"timeZone"`
	Transcript []JournalTranscriptSegment `json:"transcript"`
	Summary    *JournalSummary            `json:"summary,omitempty"`
}

func (s *Server) getJournalEntryMCP(ctx context.Context, _ *mcp.CallToolRequest, args journalMCPEntryArgs) (*mcp.CallToolResult, journalMCPEntry, error) {
	var result journalMCPEntry
	if _, err := uuid.Parse(args.ID); err != nil {
		return nil, result, errors.New("id must be a UUID")
	}
	records, err := s.journalMCPRecords(ctx)
	if err != nil {
		return nil, result, err
	}
	entry, err := s.findJournalEntry(records, args.ID)
	if err != nil || entry.Status != JournalEntryStatusReady {
		return nil, result, errors.New("journal entry not found")
	}
	result = journalMCPEntry{ID: entry.Id, RecordedAt: entry.RecordedAt, TimeZone: entry.TimeZone, Transcript: entry.Transcript, Summary: entry.Summary}
	return nil, result, nil
}

type journalMCPSummaryArgs struct {
	Period string `json:"period,omitempty" jsonschema:"Optional period: day, week, month, year, or journal"`
	Offset int    `json:"offset,omitempty" jsonschema:"Zero-based result offset; default 0"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Page size from 1 to 50; default 20"`
}
type journalMCPSummaryResult struct {
	Summaries  []JournalSummary `json:"summaries"`
	NextOffset *int             `json:"next_offset,omitempty"`
}

func (s *Server) listJournalSummariesMCP(ctx context.Context, _ *mcp.CallToolRequest, args journalMCPSummaryArgs) (*mcp.CallToolResult, journalMCPSummaryResult, error) {
	result := journalMCPSummaryResult{Summaries: []JournalSummary{}}
	_, _, limit, err := (journalMCPFilter{Offset: args.Offset, Limit: args.Limit}).validate()
	if err != nil {
		return nil, result, err
	}
	if !slices.Contains([]string{"", "day", "week", "month", "year", "journal"}, args.Period) {
		return nil, result, errors.New("invalid summary period")
	}
	records, err := s.journalMCPRecords(ctx)
	if err != nil {
		return nil, result, err
	}
	for _, record := range records {
		if record.Summary != nil && (args.Period == "" || string(record.Summary.Period) == args.Period) {
			result.Summaries = append(result.Summaries, *record.Summary)
		}
	}
	sort.Slice(result.Summaries, func(i, j int) bool {
		a, b := result.Summaries[i], result.Summaries[j]
		if a.Start.Equal(b.Start) {
			return a.Id < b.Id
		}
		return a.Start.After(b.Start)
	})
	result.Summaries, result.NextOffset = journalMCPPage(result.Summaries, args.Offset, limit)
	return nil, result, nil
}
