// Package itestconfig reads the zemn.me runtime bindings published by the Pulumi rules_itest task.
package itestconfig

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
)

type Deployment struct {
	Environment     map[string]string `json:"environment"`
	JournalQueueURL string            `json:"journalQueueURL"`
	AWS             aws.Config        `json:"-"`
}

// Load connects to the same emulator that Pulumi used for this test's deployment.
func Load(ctx context.Context) (*Deployment, error) {
	var manifest struct {
		Deployment
		Endpoint, Region, CredentialsFile, CertificateFile string
	}
	dir := os.Getenv("TEST_TMPDIR")
	if dir == "" {
		return nil, fmt.Errorf("TEST_TMPDIR is required for the Pulumi deployment")
	}
	data, err := os.ReadFile(filepath.Join(dir, "zemn-deployment.json"))
	if err != nil {
		return nil, fmt.Errorf("read Pulumi deployment: %w", err)
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	if manifest.Endpoint == "" || manifest.Region == "" || manifest.JournalQueueURL == "" || len(manifest.Environment) == 0 {
		return nil, fmt.Errorf("incomplete zemn.me Pulumi deployment")
	}
	profile, err := config.LoadSharedConfigProfile(ctx, "default", func(o *config.LoadSharedConfigOptions) {
		o.ConfigFiles = []string{}
		o.CredentialsFiles = []string{manifest.CredentialsFile}
	})
	if err != nil {
		return nil, err
	}
	if !profile.Credentials.HasKeys() {
		return nil, fmt.Errorf("no credentials for AWS Emulator")
	}
	certificate, err := os.ReadFile(manifest.CertificateFile)
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(certificate) {
		return nil, fmt.Errorf("invalid AWS Emulator CA")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.TLSClientConfig = &tls.Config{RootCAs: roots}
	manifest.AWS = aws.Config{
		BaseEndpoint: &manifest.Endpoint,
		Region:       manifest.Region,
		Credentials:  credentials.StaticCredentialsProvider{Value: profile.Credentials},
		HTTPClient:   &http.Client{Transport: transport},
	}
	return &manifest.Deployment, nil
}
