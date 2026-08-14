package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

var (
	address    string
	ddbAddress string
)

func init() {
	flag.StringVar(&address, "address", ":0", "Address to listen on")
	flag.StringVar(&ddbAddress, "ddb-address", "", "Address of the DynamoDB server.")
}

type AssignedPorts struct {
	APIPort          string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
	OIDCProviderPort string `json:"@@//project/me/zemn/testing:oidc_provider_itest_service"`
}

func main() {
	flag.Parse()

	assignedPorts := os.Getenv("ASSIGNED_PORTS")
	if assignedPorts != "" {
		var ports AssignedPorts
		if err := json.Unmarshal([]byte(assignedPorts), &ports); err != nil {
			log.Fatalf("failed to parse ASSIGNED_PORTS: %v (%s)", err)
		}

		ddbAddress = "http://localhost:" + ports.APIPort
		if ports.OIDCProviderPort != "" {
			issuer := fmt.Sprintf("http://localhost:%s", ports.OIDCProviderPort)
			mustSetEnv("ZEMN_TEST_OIDC_ISSUER", issuer)
			mustSetEnv("ZEMN_TEST_OIDC_PROVIDER", issuer)
		}
	}

	if os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_CLIENT_ID", "integration-test-client")
	}
	if os.Getenv("ZEMN_TEST_OIDC_SUBJECT") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_SUBJECT", "integration-test-remote")
	}
	if os.Getenv("ZEMN_TEST_OIDC_LOCAL_SUBJECT") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_LOCAL_SUBJECT", "integration-test-local")
	}

	mustSetEnv("DYNAMODB_ENDPOINT", ddbAddress)
	mustSetEnv("DYNAMODB_TABLE_NAME", "table1")
	mustSetEnv("ANALYTICS_TABLE_NAME", "table2")
	mustSetEnv("GRIEVANCES_TABLE_NAME", "table3")
	mustSetEnv("USERS_TABLE_NAME", "table4")
	mustSetEnv("CALLBOX_KEY_TABLE_NAME", "table5")
	mustSetEnv("JOURNAL_TABLE_NAME", "table6")
	mustSetEnv("JOURNAL_BUCKET_NAME", "local-journal")

	ln, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	addr := ln.Addr().(*net.TCPAddr)
	journalStore, err := newLocalJournalStore(fmt.Sprintf("http://localhost:%d", addr.Port), log.Default())
	if err != nil {
		log.Fatalf("create local journal storage: %v", err)
	}
	defer journalStore.Close()
	var journalAI apiserver.JournalAI = localJournalAI{}
	if apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY")); apiKey != "" {
		journalAI = apiserver.NewOpenAIJournalAI(apiKey)
		log.Print("local journal will use OpenAI for transcription and summaries")
	} else {
		log.Print("local journal will use deterministic development transcripts; set OPENAI_API_KEY for live processing")
	}

	srv, err := apiserver.NewServer(context.Background(), apiserver.NewServerOptions{
		LocalStack:              true,
		AllowLocalhostAnalytics: true,
		JournalAI:               journalAI,
		JournalObjects:          journalStore,
		JournalPresigner:        journalStore,
	})
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	if assignedPorts != "" {
		if err = srv.ProvisionTables(context.Background()); err != nil {
			log.Fatalf("failed to provision tables: %v", err)
		}
	}

	journalStore.SetUploadProcessor(srv.ProcessJournalUpload)
	mux := http.NewServeMux()
	mux.Handle(localJournalObjectPath, journalStore)
	mux.HandleFunc(localJournalRefreshPath, func(w http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		at := time.Now()
		if value := request.URL.Query().Get("at"); value != "" {
			parsed, err := time.Parse(time.RFC3339, value)
			if err != nil {
				http.Error(w, "at must be an RFC3339 timestamp", http.StatusBadRequest)
				return
			}
			at = parsed
		}
		if err := srv.RefreshJournalSummaries(request.Context(), at); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.Handle("/", srv)
	fmt.Printf("PORT=%d\n", addr.Port)
	if err := http.Serve(ln, mux); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

type localJournalAI struct{}

func (localJournalAI) Transcribe(_ context.Context, audio io.Reader, _ string) (apiserver.JournalTranscriptionResult, error) {
	bytes, err := io.Copy(io.Discard, audio)
	if err != nil {
		return apiserver.JournalTranscriptionResult{}, err
	}
	texts := []string{
		fmt.Sprintf("Local development transcript for a %d-byte voice note, with enough deterministic text to exercise the scrollable transcript in the browser.", bytes),
		"This second passage makes the local transcript resemble a longer spoken journal instead of a single short testing sentence.",
		"As playback moves forward, each passage becomes highlighted and the transcript follows only when that highlighted passage changes.",
		"A reader can still scroll away from the active passage and inspect nearby text without every audio time update pulling the view back.",
		"The final passage gives the development server enough content to demonstrate and test the bottom of the scrolling transcript.",
	}
	segments := make([]apiserver.JournalTranscriptSegment, 0, len(texts))
	for index, text := range texts {
		start := int64(index) * 2000
		if index >= 3 {
			// Exercise the transcript's paragraph break for long silences in development.
			start += 3200
		}
		segments = append(segments, apiserver.JournalTranscriptSegment{
			Id:      fmt.Sprintf("s%d", index),
			StartMs: start,
			EndMs:   start + 2000,
			Text:    text,
		})
	}
	return apiserver.JournalTranscriptionResult{
		DurationMs: segments[len(segments)-1].EndMs,
		Segments:   segments,
	}, nil
}

func (localJournalAI) Summarize(_ context.Context, period string, sources []apiserver.JournalSummarySource) (apiserver.JournalSummaryResult, error) {
	citations := make([]apiserver.JournalCitation, 0)
	for _, source := range sources {
		citations = append(citations, source.Citations...)
	}
	var references strings.Builder
	for index := range citations {
		fmt.Fprintf(&references, "[^%d]", index+1)
	}
	return apiserver.JournalSummaryResult{
		Title: fmt.Sprintf("Local %s journal", period),
		Blocks: []apiserver.JournalSummaryBlock{{
			Markdown:  "This deterministic summary includes **rendered Markdown** from the local development server." + references.String(),
			Citations: citations,
		}},
	}, nil
}

func mustSetEnv(key, value string) {
	if value == "" {
		return
	}
	if err := os.Setenv(key, value); err != nil {
		log.Fatalf("failed to set %s: %v", key, err)
	}
}
