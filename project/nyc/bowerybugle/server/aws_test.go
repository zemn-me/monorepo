package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestSignedUploadEnforcesSizeTypeAndKey(t *testing.T) {
	client := s3.New(s3.Options{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("test", "test", "")})
	files := S3Files{Client: client, Bucket: "archive-test"}
	upload, err := files.Prepare(context.Background(), "issues/test.pdf")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := base64.StdEncoding.DecodeString(upload.Fields["policy"])
	if err != nil {
		t.Fatal(err)
	}
	var policy struct {
		Conditions []json.RawMessage `json:"conditions"`
	}
	if err := json.Unmarshal(raw, &policy); err != nil {
		t.Fatal(err)
	}
	checks := map[string]bool{`["content-length-range",5,52428800]`: false, `{"Content-Type":"application/pdf"}`: false, `{"key":"issues/test.pdf"}`: false}
	for _, condition := range policy.Conditions {
		if _, ok := checks[string(condition)]; ok {
			checks[string(condition)] = true
		}
	}
	for condition, found := range checks {
		if !found {
			t.Errorf("upload policy missing %s: %s", condition, raw)
		}
	}
	if upload.Fields["Content-Type"] != "application/pdf" {
		t.Fatal("PDF type missing from form")
	}
}
func TestInspectionAndDownloadUseImmutableVersion(t *testing.T) {
	var version, byteRange string
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" {
			w.Header().Set("Content-Length", "9")
			w.Header().Set("Content-Type", "application/pdf")
			w.Header().Set("x-amz-version-id", "checked-version")
			return
		}
		version = r.URL.Query().Get("versionId")
		byteRange = r.Header.Get("Range")
		w.Header().Set("Content-Length", "5")
		w.WriteHeader(206)
		_, _ = w.Write([]byte("%PDF-"))
	}))
	defer endpoint.Close()
	client := s3.New(s3.Options{Region: "us-east-1", BaseEndpoint: aws.String(endpoint.URL), UsePathStyle: true, Credentials: credentials.NewStaticCredentialsProvider("test", "test", "")})
	files := S3Files{Client: client, Bucket: "archive-test"}
	obj, err := files.Inspect(context.Background(), "issues/test.pdf")
	if err != nil {
		t.Fatal(err)
	}
	if version != "checked-version" || obj.Version != version || byteRange != "bytes=0-4" || string(obj.Prefix) != "%PDF-" {
		t.Fatalf("inspection did not pin the header read: %+v", obj)
	}
	url, err := files.Download(context.Background(), Record{Number: 6, Key: "issues/test.pdf", Version: obj.Version})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(url, "versionId=checked-version") || !strings.Contains(url, "response-content-type=application%2Fpdf") {
		t.Fatal("reader URL omitted validated version or PDF content type")
	}
}
