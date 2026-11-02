package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJournalWorkerCuratorCredentialIsolation(t *testing.T) {
	for _, apiKey := range []string{"", "  ", "test-curator-key"} {
		t.Run(apiKey, func(t *testing.T) {
			for name, value := range map[string]string{
				"AWS_REGION": "us-east-1", "AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test",
				"AWS_EC2_METADATA_DISABLED": "true", "JOURNAL_TABLE_NAME": "test-table", "JOURNAL_BUCKET_NAME": "test-bucket",
				"OPENAI_IDENTITY_PROVIDER_ID": "test-provider", "OPENAI_SERVICE_ACCOUNT_ID": "test-account", "OPENAI_CURATOR_API_KEY": apiKey,
			} {
				t.Setenv(name, value)
			}
			worker, err := NewJournalWorker(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			audioAI := worker.server.journalAI.(*openAIJournalAI)
			curator := worker.server.journalCurator.(*openAIJournalCurator)
			if audioAI.workloadIdentity == nil || audioAI.apiKey != "" {
				t.Fatal("curator key changed audio processing credentials")
			}
			if apiKey != "test-curator-key" {
				if curator.ai != audioAI {
					t.Fatal("without a curator key, curation must retain workload identity")
				}
				return
			}
			if curator.ai.workloadIdentity != nil {
				t.Fatal("configured curator key must not invoke workload token exchange")
			}
			service := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer test-curator-key" {
					t.Error("curator did not authenticate with its dedicated key")
				}
				w.WriteHeader(http.StatusNoContent)
			}))
			defer service.Close()
			req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, service.URL, nil)
			if err != nil {
				t.Fatal(err)
			}
			response, err := curator.ai.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			response.Body.Close()
		})
	}
}
