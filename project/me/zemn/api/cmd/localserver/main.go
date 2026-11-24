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

	"github.com/zemn-me/monorepo/project/me/zemn/api/itestconfig"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

var (
	address          string
	ddbAddress       string
	useAWSEmulator   bool
	runJournalWorker bool
)

func init() {
	flag.BoolVar(&runJournalWorker, "journal-worker", false, "Run the deployed journal image entrypoint against AWS Emulator")
	flag.BoolVar(&useAWSEmulator, "aws-emulator", false, "Run against the rules_itest AWS Emulator service")
	flag.StringVar(&address, "address", ":0", "Address to listen on")
	flag.StringVar(&ddbAddress, "ddb-address", "", "Address of the DynamoDB server.")
}

type AssignedPorts struct {
	NextPort         string `json:"@@//project/me/zemn:itest_service"`
	CalendarNextPort string `json:"@@//project/me/zemn:itest_service_calendar_fixture"`
	DynamoDBPort     string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
	OIDCProviderPort string `json:"@@//project/me/zemn/testing:oidc_provider_itest_service"`
}

func main() {
	flag.Parse()
	if runJournalWorker {
		if err := runEmulatedJournalWorker(context.Background()); err != nil {
			log.Fatal(err)
		}
		return
	}

	assignedPorts := os.Getenv("ASSIGNED_PORTS")
	if assignedPorts != "" {
		var ports AssignedPorts
		if err := json.Unmarshal([]byte(assignedPorts), &ports); err != nil {
			log.Fatalf("failed to parse ASSIGNED_PORTS: %v", err)
		}

		if ports.DynamoDBPort != "" {
			ddbAddress = "http://localhost:" + ports.DynamoDBPort
		}
		if ports.NextPort == "" {
			ports.NextPort = ports.CalendarNextPort
		}
		if ports.NextPort != "" {
			mustSetEnv("OAUTH_FRONTEND_ORIGIN", "http://localhost:"+ports.NextPort)
		}
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

	if os.Getenv("OAUTH_FRONTEND_ORIGIN") == "" {
		mustSetEnv("OAUTH_FRONTEND_ORIGIN", "http://localhost:3000")
	}

	ln, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	addr := ln.Addr().(*net.TCPAddr)
	var journalAI apiserver.JournalAI = localJournalAI{}
	if apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY")); apiKey != "" && !useAWSEmulator {
		journalAI = apiserver.NewOpenAIJournalAI(apiKey)
		log.Print("local journal will use OpenAI for transcription and summaries")
	} else {
		log.Print("local journal will use deterministic development transcripts")
	}

	opts := apiserver.NewServerOptions{
		LocalStack:                 true,
		AllowRequestHostOIDCIssuer: true,
		AllowLocalhostAnalytics:    true,
		JournalAI:                  journalAI,
		JournalCurator:             &localJournalCurator{},
	}
	ctx := context.Background()
	mux := http.NewServeMux()
	apiOrigin := fmt.Sprintf("http://localhost:%d", addr.Port)
	var localStore *localJournalStore
	if useAWSEmulator {
		deployment, err := itestconfig.Load(ctx)
		if err != nil {
			log.Fatal(err)
		}
		for name, value := range deployment.Environment {
			mustSetEnv(name, value)
		}
		opts.AWSConfig = &deployment.AWS
		if err := configureEmulatedJournal(ctx, deployment.AWS, apiOrigin, mux, &opts); err != nil {
			log.Fatalf("configure emulated journal: %v", err)
		}
	} else {
		mustSetEnv("DYNAMODB_ENDPOINT", ddbAddress)
		mustSetEnv("DYNAMODB_TABLE_NAME", "table1")
		mustSetEnv("ANALYTICS_TABLE_NAME", "table2")
		mustSetEnv("GRIEVANCES_TABLE_NAME", "table3")
		mustSetEnv("USERS_TABLE_NAME", "table4")
		mustSetEnv("CALLBOX_KEY_TABLE_NAME", "table5")
		mustSetEnv("JOURNAL_TABLE_NAME", "table6")
		mustSetEnv("OAUTH_TABLE_NAME", "oauth")
		mustSetEnv("JOURNAL_BUCKET_NAME", "local-journal")
		store, err := newLocalJournalStore(apiOrigin, log.Default())
		if err != nil {
			log.Fatal(err)
		}
		defer store.Close()
		opts.JournalObjects, opts.JournalPresigner = store, store
		mux.Handle(localJournalObjectPath, store)
		localStore = store
	}
	srv, err := apiserver.NewServer(ctx, opts)
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	if assignedPorts != "" && !useAWSEmulator {
		if err = srv.ProvisionTables(context.Background()); err != nil {
			log.Fatalf("failed to provision tables: %v", err)
		}
	}

	if localStore != nil {
		localStore.SetUploadProcessor(srv.ProcessJournalUpload)
	}
	mux.Handle(localJournalSeedPath, newDevelopmentJournalSeedHandler(srv))
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
	texts := []string(nil)
	if fixture := developmentJournalFixtureForByteLength(bytes); fixture != nil {
		texts = fixture.transcript
	} else {
		texts = []string{
			fmt.Sprintf("Local development transcript for a %d-byte voice note, with enough deterministic text to exercise the scrollable transcript in the browser.", bytes),
			"This second passage makes the local transcript resemble a longer spoken journal instead of a single short testing sentence.",
			"As playback moves forward, each passage becomes highlighted and the transcript follows only when that highlighted passage changes.",
			"A reader can still scroll away from the active passage and inspect nearby text without every audio time update pulling the view back.",
			"The final passage gives the development server enough content to demonstrate and test the bottom of the scrolling transcript.",
		}
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

func (ai localJournalAI) AnalyzeEntry(ctx context.Context, _ time.Time, _ string, sources []apiserver.JournalSummarySource) (apiserver.JournalEntryAnalysisResult, error) {
	summary, err := ai.Summarize(ctx, "entry", sources)
	return apiserver.JournalEntryAnalysisResult{Summary: summary}, err
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
	title := fmt.Sprintf("Local %s journal", period)
	markdown := "This deterministic summary includes **rendered Markdown** from the local development server."
	if period == "entry" && len(sources) > 0 {
		for _, fixture := range developmentJournalFixtures {
			if strings.Contains(sources[0].Text, fixture.transcript[0]) {
				title = fixture.title
				markdown = fixture.summary
				break
			}
		}
	} else if len(sources) > 0 {
		titles := map[string]string{
			"day":     "A day that found its own pace",
			"week":    "Making room for steadier work",
			"month":   "Experiments in attention",
			"year":    "A life with more room in it",
			"journal": "Work, friendship, and learning to slow down",
		}
		if value := titles[period]; value != "" {
			title = value
		}
		markdown = fmt.Sprintf("Across this %s, the entries trace a move toward **clearer priorities**, more candid relationships, and a gentler pace.", period)
	}
	return apiserver.JournalSummaryResult{
		Title: title,
		Blocks: []apiserver.JournalSummaryBlock{{
			Markdown:  markdown + references.String(),
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
