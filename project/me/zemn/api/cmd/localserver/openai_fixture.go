package main

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/zemn-me/monorepo/project/me/zemn/api/itestconfig"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

func runEmulatedJournalWorker(ctx context.Context) error {
	d, err := itestconfig.Load(ctx)
	if err != nil {
		return err
	}
	env, closeFixture, err := journalWorkerFixture(d.CertificateFile)
	if err != nil {
		return err
	}
	defer closeFixture()
	return d.JournalWorker.Consume(ctx, d.AWS, append(d.LambdaEnvironment(), env...))
}

// Keep the worker's real STS and OpenAI clients. Its HTTPS proxy connects
// only the two OpenAI hosts to the deterministic local service.
func journalWorkerFixture(emulatorCA string) ([]string, func(), error) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	cert := &x509.Certificate{
		SerialNumber: big.NewInt(1), DNSNames: []string{"api.openai.com", "auth.openai.com"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, cert, cert, public, private)
	if err != nil {
		return nil, nil, err
	}
	ca, err := os.ReadFile(emulatorCA)
	if err != nil {
		return nil, nil, err
	}
	bundle := filepath.Join(os.Getenv("TEST_TMPDIR"), "journal-worker-ca.pem")
	if err := os.WriteFile(bundle, append(ca, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})...), 0600); err != nil {
		return nil, nil, err
	}
	api := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := serveOpenAIFixture(w, r); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
	}))
	api.TLS = &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: private}}}
	api.StartTLS()
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect || (r.Host != "api.openai.com:443" && r.Host != "auth.openai.com:443") {
			http.Error(w, "unknown fixture destination", http.StatusForbidden)
			return
		}
		dest, err := net.Dial("tcp", api.Listener.Addr().String())
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer dest.Close()
		client, rw, err := http.NewResponseController(w).Hijack()
		if err != nil {
			return
		}
		defer client.Close()
		if _, err := io.WriteString(client, "HTTP/1.1 200 Connection Established\r\n\r\n"); err != nil {
			return
		}
		go func() {
			_, _ = io.Copy(dest, rw)
			dest.Close()
		}()
		_, _ = io.Copy(client, dest)
	}))
	return []string{
		"SSL_CERT_FILE=" + bundle,
		"HTTPS_PROXY=" + proxy.URL,
		"HTTP_PROXY=" + proxy.URL,
		"NO_PROXY=127.0.0.1,localhost",
		// This browser suite exercises immediate entry and period summaries.
		"JOURNAL_CURATION_ENABLED=false",
	}, func() { proxy.Close(); api.Close() }, nil
}

func serveOpenAIFixture(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("unexpected method %s", r.Method)
	}
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	const accessToken = "journal-fixture"
	if r.Host == "auth.openai.com" && r.URL.Path == "/oauth/token" {
		var exchange struct {
			SubjectToken string `json:"subject_token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&exchange); err != nil {
			return err
		}
		if exchange.SubjectToken == "" {
			return fmt.Errorf("missing STS token")
		}
		return enc.Encode(map[string]any{"access_token": accessToken, "token_type": "Bearer", "expires_in": 3600})
	}
	if r.Host != "api.openai.com" || r.Header.Get("Authorization") != "Bearer "+accessToken {
		return fmt.Errorf("expected authenticated OpenAI request")
	}
	ai := localJournalAI{}
	switch r.URL.Path {
	case "/v1/audio/transcriptions":
		file, header, err := r.FormFile("file")
		if err != nil {
			return err
		}
		defer file.Close()
		transcript, err := ai.Transcribe(r.Context(), file, header.Header.Get("Content-Type"))
		if err != nil {
			return err
		}
		var segments []map[string]any
		for i, seg := range transcript.Segments {
			segments = append(segments, map[string]any{"id": i, "start": float64(seg.StartMs) / 1000, "end": float64(seg.EndMs) / 1000, "text": seg.Text})
		}
		return enc.Encode(map[string]any{"duration": float64(transcript.DurationMs) / 1000, "segments": segments})
	case "/v1/responses":
		var req struct {
			Input string
			Text  struct{ Format struct{ Name string } }
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return err
		}
		prompt, data, ok := strings.Cut(req.Input, "\n[")
		if !ok {
			return fmt.Errorf("missing journal sources")
		}
		var sources []apiserver.JournalSummarySource
		if err := json.Unmarshal([]byte("["+data), &sources); err != nil {
			return err
		}
		var result any
		var err error
		switch req.Text.Format.Name {
		case "journal_entry_analysis":
			result, err = ai.AnalyzeEntry(r.Context(), time.Time{}, "", sources)
		case "journal_summary":
			var period string
			if _, err := fmt.Sscanf(prompt, "Create the %s summary", &period); err != nil {
				return err
			}
			result, err = ai.Summarize(r.Context(), period, sources)
		default:
			return fmt.Errorf("unknown journal schema %q", req.Text.Format.Name)
		}
		if err != nil {
			return err
		}
		text, err := json.Marshal(result)
		if err != nil {
			return err
		}
		content := []map[string]string{{"type": "output_text", "text": string(text)}}
		message := map[string]any{"type": "message", "content": content}
		return enc.Encode(map[string]any{"output": []any{message}})
	default:
		return fmt.Errorf("unknown OpenAI fixture path %s", r.URL.Path)
	}
}
