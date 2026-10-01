// Package server serves the Bowery Bugle archive and its author-only publishing API.
package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const MaxPDFBytes int64 = 50 << 20
const sessionCookie = "__Host-bugle-session"

var ErrMissing = errors.New("record missing or expired")

// Expiry is checked on every use; DynamoDB TTL cleanup is asynchronous.
type Record struct {
	Kind    string `dynamodbav:"kind"`
	ID      string `dynamodbav:"id"`
	Expires int64  `dynamodbav:"expires,omitempty"`
	Number  int    `dynamodbav:"number,omitempty"`
	Key     string `dynamodbav:"object_key,omitempty"`
	Version string `dynamodbav:"version,omitempty"`
	Size    int64  `dynamodbav:"size,omitempty"`
}
type Store interface {
	Get(context.Context, string, string) (Record, error)
	Put(context.Context, string, string, Record) error
	Take(context.Context, string, string, int64) (Record, error)
	Limit(context.Context, string, int64, int64, int) (bool, error)
	Issues(context.Context) ([]Record, error)
	Publish(context.Context, string, int64, Record) error
}
type Upload struct {
	URL    string            `json:"url"`
	Fields map[string]string `json:"fields"`
	ID     string            `json:"id"`
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
	Send(context.Context, string, string) error
}
type Server struct {
	Store  Store
	Files  Files
	Mail   Mailer
	Origin string
	Author string
	Now    func() time.Time
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
	jsonResponse(w, status, map[string]string{"error": message})
}
func failure(w http.ResponseWriter, err error) {
	slog.Error("archive operation failed", "error", err)
	problem(w, 503, "Something went wrong. Please try again.")
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		problem(w, 400, "Invalid request.")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		problem(w, 400, "Invalid request.")
		return false
	}
	return true
}
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/issues", s.issues)
	mux.HandleFunc("GET /api/issues/{number}/pdf", s.pdf)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/login/confirm", s.confirm)
	mux.HandleFunc("GET /api/session", s.session)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.HandleFunc("POST /api/uploads", s.prepare)
	mux.HandleFunc("POST /api/uploads/{id}/publish", s.publish)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
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
func (s *Server) require(w http.ResponseWriter, r *http.Request) bool {
	ok, err := s.authenticated(r)
	if err != nil {
		failure(w, err)
		return false
	}
	if !ok {
		problem(w, 401, "Please log in again.")
	}
	return ok
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &req) {
		return
	}
	// The address is configured only on the server, never advertised in the page.
	if strings.ToLower(strings.TrimSpace(req.Email)) != s.Author {
		jsonResponse(w, 202, map[string]bool{"sent": true})
		return
	}
	now := s.now().Unix()
	for _, limit := range []struct {
		key     string
		expires int64
		max     int
	}{{"login-minute", now + 60, 1}, {fmt.Sprintf("login-hour-%d", now/3600), (now/3600 + 1) * 3600, 10}} {
		ok, err := s.Store.Limit(r.Context(), limit.key, now, limit.expires, limit.max)
		if err != nil {
			failure(w, err)
			return
		}
		if !ok {
			problem(w, 429, "Please wait before requesting another link.")
			return
		}
	}
	t := token()
	id := digest(t)
	if err := s.Store.Put(r.Context(), "challenge", id, Record{Expires: now + 600}); err != nil {
		failure(w, err)
		return
	}
	// Fragments are not sent in HTTP requests or Referrer headers. The page requires
	// a confirmation click before exchanging the token, so link previews cannot log in.
	if err := s.Mail.Send(r.Context(), s.Author, s.Origin+"/#login="+t); err != nil {
		_, _ = s.Store.Take(r.Context(), "challenge", id, now)
		failure(w, err)
		return
	}
	jsonResponse(w, 202, map[string]bool{"sent": true})
}
func (s *Server) confirm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if !decode(w, r, &req) {
		return
	}
	if !validToken(req.Token) {
		problem(w, 400, "This link is invalid or has expired. Request a new one.")
		return
	}
	now := s.now()
	_, err := s.Store.Take(r.Context(), "challenge", digest(req.Token), now.Unix())
	if errors.Is(err, ErrMissing) {
		problem(w, 400, "This link is invalid or has expired. Request a new one.")
		return
	}
	if err != nil {
		failure(w, err)
		return
	}
	t := token()
	expires := now.Add(7 * 24 * time.Hour)
	if err := s.Store.Put(r.Context(), "session", digest(t), Record{Expires: expires.Unix()}); err != nil {
		failure(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: t, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 7 * 24 * 3600, Expires: expires})
	jsonResponse(w, 200, map[string]bool{"authenticated": true})
}
func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	ok, err := s.authenticated(r)
	if err != nil {
		failure(w, err)
		return
	}
	jsonResponse(w, 200, map[string]bool{"authenticated": ok})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, e := r.Cookie(sessionCookie); e == nil {
		_, err := s.Store.Take(r.Context(), "session", digest(c.Value), 0)
		if err != nil && !errors.Is(err, ErrMissing) {
			failure(w, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
	jsonResponse(w, 200, map[string]bool{"authenticated": false})
}

type Issue struct {
	Number int    `json:"number"`
	PDF    string `json:"pdf,omitempty"`
	Size   int64  `json:"size,omitempty"`
}

func (s *Server) issues(w http.ResponseWriter, r *http.Request) {
	records, err := s.Store.Issues(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	issues := map[int]Issue{}
	for n := 1; n <= 6; n++ {
		issues[n] = Issue{Number: n}
	}
	for _, rec := range records {
		issues[rec.Number] = Issue{Number: rec.Number, PDF: fmt.Sprintf("/api/issues/%d/pdf", rec.Number), Size: rec.Size}
	}
	out := make([]Issue, 0, len(issues))
	for _, i := range issues {
		out = append(out, i)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Number > out[j].Number })
	jsonResponse(w, 200, map[string]any{"issues": out})
}
func (s *Server) pdf(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("number"))
	if err != nil || n < 1 || n > 9999 {
		problem(w, 404, "Issue not found.")
		return
	}
	rec, err := s.Store.Get(r.Context(), "issue", issueID(n))
	if errors.Is(err, ErrMissing) {
		problem(w, 404, "PDF not uploaded yet.")
		return
	}
	if err != nil {
		failure(w, err)
		return
	}
	url, err := s.Files.Download(r.Context(), rec)
	if err != nil {
		failure(w, err)
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}
func (s *Server) prepare(w http.ResponseWriter, r *http.Request) {
	if !s.require(w, r) {
		return
	}
	var req struct {
		Number int   `json:"number"`
		Size   int64 `json:"size"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Number < 1 || req.Number > 9999 || req.Size < 5 || req.Size > MaxPDFBytes {
		problem(w, 400, "Choose an issue number and a PDF up to 50 MB.")
		return
	}
	id := token()
	key := "issues/" + id + ".pdf"
	upload, err := s.Files.Prepare(r.Context(), key)
	if err != nil {
		failure(w, err)
		return
	}
	if err := s.Store.Put(r.Context(), "upload", id, Record{Number: req.Number, Key: key, Size: req.Size, Expires: s.now().Unix() + 900}); err != nil {
		failure(w, err)
		return
	}
	upload.ID = id
	jsonResponse(w, 200, upload)
}
func (s *Server) publish(w http.ResponseWriter, r *http.Request) {
	if !s.require(w, r) {
		return
	}
	id := r.PathValue("id")
	if !validToken(id) {
		problem(w, 400, "Invalid upload.")
		return
	}
	rec, err := s.Store.Get(r.Context(), "upload", id)
	if errors.Is(err, ErrMissing) || err == nil && rec.Expires <= s.now().Unix() {
		problem(w, 400, "This upload has expired. Please upload again.")
		return
	}
	if err != nil {
		failure(w, err)
		return
	}
	obj, err := s.Files.Inspect(r.Context(), rec.Key)
	if err != nil {
		failure(w, err)
		return
	}
	if obj.Version == "" || obj.Version == "null" || obj.Size != rec.Size || obj.Size > MaxPDFBytes || obj.ContentType != "application/pdf" || !strings.HasPrefix(string(obj.Prefix), "%PDF-") {
		problem(w, 400, "That file is not a valid PDF upload.")
		return
	}
	// Pin the inspected version. A still-valid upload URL must never replace the
	// bytes readers see after publication without another validation step.
	rec.Version = obj.Version
	rec.Expires = 0
	if err := s.Store.Publish(r.Context(), id, s.now().Unix(), rec); err != nil {
		if errors.Is(err, ErrMissing) {
			problem(w, 409, "This upload has already been published or expired.")
		} else {
			failure(w, err)
		}
		return
	}
	jsonResponse(w, 200, Issue{Number: rec.Number, PDF: fmt.Sprintf("/api/issues/%d/pdf", rec.Number), Size: rec.Size})
}
