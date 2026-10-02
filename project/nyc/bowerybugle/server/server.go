// Package server serves the Bowery Bugle archive and its author-only publishing API.
package server

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"
)

const MaxPDFBytes int64 = 50 << 20
const sessionCookie = "__Host-bugle-session"

var ErrMissing = errors.New("record missing or expired")
var ErrConflict = errors.New("issue changed")

// Expiry is checked on every use; DynamoDB TTL cleanup is asynchronous.
type Record struct {
	Deleted  bool   `dynamodbav:"deleted,omitempty"`
	Revision string `dynamodbav:"revision,omitempty"`
	Kind     string `dynamodbav:"kind"`
	ID       string `dynamodbav:"id"`
	Expires  int64  `dynamodbav:"expires,omitempty"`
	Number   int    `dynamodbav:"number,omitempty"`
	Key      string `dynamodbav:"object_key,omitempty"`
	Version  string `dynamodbav:"version,omitempty"`
	Size     int64  `dynamodbav:"size,omitempty"`
}
type Store interface {
	Get(context.Context, string, string) (Record, error)
	Put(context.Context, string, string, Record) error
	Take(context.Context, string, string, int64) (Record, error)
	Limit(context.Context, string, int64, int64, int) (bool, error)
	Issues(context.Context) ([]Record, error)
	Publish(context.Context, string, int64, Record) error
	ReplaceIssue(context.Context, Record, Record) error
}
type Object struct {
	Version     string
	Size        int64
	ContentType string
	Prefix      []byte
}
type Files interface {
	Prepare(context.Context, string) (Upload, error)
	Inspect(context.Context, string) (Object, error)
	Download(context.Context, Record) (string, error)
}
type Mailer interface {
	Send(context.Context, string, LoginEmail) error
}
type Server struct {
	Store    Store
	Files    Files
	Mail     Mailer
	Origin   string
	Author   string
	LoginKey []byte
	Now      func() time.Time
}

func (s *Server) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func digest(t string) string { d := sha256.Sum256([]byte(t)); return hex.EncodeToString(d[:]) }
func validToken(t string) bool {
	b, e := base64.RawURLEncoding.DecodeString(t)
	return e == nil && len(b) == 32
}
func issueID(n int) string { return fmt.Sprintf("%04d", n) }
func jsonResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func problem(w http.ResponseWriter, status int, message string) {
	jsonResponse(w, status, Problem{Error: message})
}
func failure(w http.ResponseWriter, err error) {
	slog.Error("archive operation failed", "error", err)
	problem(w, 503, "Something went wrong. Please try again.")
}
func (s *Server) Handler() http.Handler {
	mux := s.apiHandler()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Add("Vary", "Origin")
		if origin := r.Header.Get("Origin"); origin != "" && origin != s.Origin {
			problem(w, 403, "Request origin not allowed.")
			return
		} else if origin == s.Origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			if r.Header.Get("Origin") != s.Origin {
				problem(w, 403, "Request origin not allowed.")
				return
			}
			switch r.Header.Get("Access-Control-Request-Method") {
			case "GET", "POST", "DELETE":
			default:
				problem(w, 403, "Request method not allowed.")
				return
			}
			for _, header := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				if h := strings.TrimSpace(header); h != "" && !strings.EqualFold(h, "Content-Type") {
					problem(w, 403, "Request header not allowed.")
					return
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && r.Header.Get("Origin") != s.Origin {
			problem(w, 403, "Request origin not allowed.")
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func (s *Server) authenticated(r *http.Request) (bool, error) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || !validToken(c.Value) {
		return false, nil
	}
	rec, err := s.Store.Get(r.Context(), "session", digest(c.Value))
	if errors.Is(err, ErrMissing) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return rec.Expires > s.now().Unix(), nil
}
func (s *Server) RequestLogin(ctx context.Context, request RequestLoginRequestObject) (RequestLoginResponseObject, error) {
	req := request.Body
	// The address is configured only on the server, never advertised in the page.
	if strings.ToLower(strings.TrimSpace(req.Email)) != s.Author {
		return RequestLogin202JSONResponse{Sent: true}, nil
	}
	now := s.now().Unix()
	for _, limit := range []struct {
		key     string
		expires int64
		max     int
	}{{"login-minute", now + 60, 1}, {fmt.Sprintf("login-hour-%d", now/3600), (now/3600 + 1) * 3600, 10}} {
		ok, err := s.Store.Limit(ctx, limit.key, now, limit.expires, limit.max)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, apiError{429, "Please wait before requesting another link."}
		}
	}
	code, expires, err := s.loginCode(s.now())
	if err != nil {
		return nil, err
	}
	// The code stays out of request URLs and is exchanged only after a click.
	if err := s.Mail.Send(ctx, s.Author, LoginEmail{Link: s.Origin + "/manage#login=" + code, Code: code, Expires: expires}); err != nil {
		return nil, err
	}
	return RequestLogin202JSONResponse{Sent: true}, nil
}
func (s *Server) ConfirmLogin(ctx context.Context, request ConfirmLoginRequestObject) (ConfirmLoginResponseObject, error) {
	req := request.Body
	now := s.now()
	code, expires, err := s.loginCode(now)
	if err != nil {
		return nil, err
	}
	for _, limit := range []struct {
		key     string
		expires int64
		max     int
	}{
		{"verify-minute", now.Unix() + 60, 10},
		{fmt.Sprintf("verify-window-%d", expires.Unix()), expires.Unix(), 100},
	} {
		ok, err := s.Store.Limit(ctx, limit.key, now.Unix(), limit.expires, limit.max)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, apiError{429, "Too many login attempts. Please try again later."}
		}
	}
	// Reuse within the current window is intentional. Do not record or consume
	// individual challenges, and do not accept adjacent 12-hour windows.
	if !hmac.Equal([]byte(req.Token), []byte(code)) {
		return nil, apiError{400, "This link is invalid or has expired. Request a new one."}
	}
	t := token()
	sessionExpires := now.Add(7 * 24 * time.Hour)
	if err := s.Store.Put(ctx, "session", digest(t), Record{Expires: sessionExpires.Unix()}); err != nil {
		return nil, err
	}
	cookie := (&http.Cookie{Name: sessionCookie, Value: t, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 7 * 24 * 3600, Expires: sessionExpires}).String()
	return ConfirmLogin200JSONResponse{Body: Session{Authenticated: true}, Headers: ConfirmLogin200ResponseHeaders{SetCookie: cookie}}, nil
}
func (s *Server) GetSession(ctx context.Context, request GetSessionRequestObject) (GetSessionResponseObject, error) {
	ok, err := s.authenticated(protocolRequest(ctx))
	if err != nil {
		return nil, err
	}
	return GetSession200JSONResponse{Authenticated: ok}, nil
}
func (s *Server) Logout(ctx context.Context, request LogoutRequestObject) (LogoutResponseObject, error) {
	if c, e := protocolRequest(ctx).Cookie(sessionCookie); e == nil {
		_, err := s.Store.Take(ctx, "session", digest(c.Value), 0)
		if err != nil && !errors.Is(err, ErrMissing) {
			return nil, err
		}
	}
	cookie := (&http.Cookie{Name: sessionCookie, Value: "", Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1}).String()
	return Logout200JSONResponse{Body: Session{Authenticated: false}, Headers: Logout200ResponseHeaders{SetCookie: cookie}}, nil
}

func (s *Server) ListIssues(ctx context.Context, request ListIssuesRequestObject) (ListIssuesResponseObject, error) {
	records, err := s.Store.Issues(ctx)
	if err != nil {
		return nil, err
	}
	issues := map[int]Issue{}
	for n := 1; n <= 6; n++ {
		issues[n] = Issue{Number: n}
	}
	for _, rec := range records {
		if rec.Deleted {
			delete(issues, rec.Number)
			continue
		}
		issue := Issue{Number: rec.Number}
		if rec.Key != "" {
			issue.PDF = fmt.Sprintf("/api/issues/%d/pdf", rec.Number)
			issue.Size = rec.Size
		}
		issues[rec.Number] = issue
	}
	out := make([]Issue, 0, len(issues))
	for _, i := range issues {
		out = append(out, i)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Number > out[j].Number })
	return ListIssues200JSONResponse{Issues: out}, nil
}
func (s *Server) ReadPDF(ctx context.Context, request ReadPDFRequestObject) (ReadPDFResponseObject, error) {
	n := request.Number
	rec, err := s.Store.Get(ctx, "issue", issueID(n))
	if errors.Is(err, ErrMissing) || err == nil && (rec.Deleted || rec.Key == "") {
		return nil, apiError{404, "PDF not uploaded yet."}
	}
	if err != nil {
		return nil, err
	}
	url, err := s.Files.Download(ctx, rec)
	if err != nil {
		return nil, err
	}
	return ReadPDF302Response{Headers: ReadPDF302ResponseHeaders{Location: url}}, nil
}
func (s *Server) PrepareUpload(ctx context.Context, request PrepareUploadRequestObject) (PrepareUploadResponseObject, error) {
	req := request.Body
	issue, err := s.issue(ctx, req.Number)
	if errors.Is(err, ErrMissing) || err == nil && issue.Deleted {
		return nil, apiError{404, "Add this issue before uploading a PDF."}
	}
	if err != nil {
		return nil, err
	}
	id := token()
	key := "issues/" + id + ".pdf"
	upload, err := s.Files.Prepare(ctx, key)
	if err != nil {
		return nil, err
	}
	if err := s.Store.Put(ctx, "upload", id, Record{Number: req.Number, Revision: issue.Revision, Key: key, Size: req.Size, Expires: s.now().Unix() + 900}); err != nil {
		return nil, err
	}
	upload.ID = id
	return PrepareUpload200JSONResponse(upload), nil
}
func (s *Server) PublishUpload(ctx context.Context, request PublishUploadRequestObject) (PublishUploadResponseObject, error) {
	id := request.Id
	if !validToken(id) {
		return nil, apiError{400, "Invalid upload."}
	}
	rec, err := s.Store.Get(ctx, "upload", id)
	if errors.Is(err, ErrMissing) || err == nil && rec.Expires <= s.now().Unix() {
		return nil, apiError{400, "This upload has expired. Please upload again."}
	}
	if err != nil {
		return nil, err
	}
	obj, err := s.Files.Inspect(ctx, rec.Key)
	if err != nil {
		return nil, err
	}
	if obj.Version == "" || obj.Version == "null" || obj.Size != rec.Size || obj.Size > MaxPDFBytes || obj.ContentType != "application/pdf" || !strings.HasPrefix(string(obj.Prefix), "%PDF-") {
		return nil, apiError{400, "That file is not a valid PDF upload."}
	}
	// Pin the inspected version. A still-valid upload URL must never replace the
	// bytes readers see after publication without another validation step.
	rec.Version = obj.Version
	rec.Expires = 0
	if err := s.Store.Publish(ctx, id, s.now().Unix(), rec); err != nil {
		if errors.Is(err, ErrMissing) || errors.Is(err, ErrConflict) {
			return nil, apiError{409, "This issue or upload has changed. Reload and try again."}
		}
		return nil, err
	}
	return PublishUpload200JSONResponse{Number: rec.Number, PDF: fmt.Sprintf("/api/issues/%d/pdf", rec.Number), Size: rec.Size}, nil
}

// Default issue rows exist until explicitly changed. Tombstones prevent deleted
// defaults from reappearing, and revisions invalidate uploads started before edits.
func (s *Server) issue(ctx context.Context, n int) (Record, error) {
	rec, err := s.Store.Get(ctx, "issue", issueID(n))
	if errors.Is(err, ErrMissing) && n >= 1 && n <= 6 {
		return Record{Number: n}, nil
	}
	return rec, err
}
func (s *Server) AddIssue(ctx context.Context, request AddIssueRequestObject) (AddIssueResponseObject, error) {
	req := request.Body
	old, err := s.issue(ctx, req.Number)
	if err == nil && !old.Deleted {
		return nil, apiError{409, "That issue already exists."}
	}
	if err != nil && !errors.Is(err, ErrMissing) {
		return nil, err
	}
	old.Number = req.Number
	if err := s.replaceIssue(ctx, old, Record{Number: req.Number, Revision: token()}); err != nil {
		return nil, err
	}
	return AddIssue200JSONResponse{SavedJSONResponse{Saved: true}}, nil
}
func (s *Server) DeleteIssue(ctx context.Context, request DeleteIssueRequestObject) (DeleteIssueResponseObject, error) {
	if err := s.editIssue(ctx, request.Number, true); err != nil {
		return nil, err
	}
	return DeleteIssue200JSONResponse{SavedJSONResponse{Saved: true}}, nil
}
func (s *Server) RemovePDF(ctx context.Context, request RemovePDFRequestObject) (RemovePDFResponseObject, error) {
	if err := s.editIssue(ctx, request.Number, false); err != nil {
		return nil, err
	}
	return RemovePDF200JSONResponse{SavedJSONResponse{Saved: true}}, nil
}
func (s *Server) editIssue(ctx context.Context, n int, deleted bool) error {
	old, err := s.issue(ctx, n)
	if errors.Is(err, ErrMissing) || err == nil && old.Deleted {
		return apiError{404, "Issue not found."}
	}
	if err != nil {
		return err
	}
	return s.replaceIssue(ctx, old, Record{Number: n, Revision: token(), Deleted: deleted})
}
func (s *Server) replaceIssue(ctx context.Context, old, next Record) error {
	if err := s.Store.ReplaceIssue(ctx, old, next); err != nil {
		if errors.Is(err, ErrConflict) {
			return apiError{409, "This issue has changed. Reload and try again."}
		}
		return err
	}
	return nil
}
