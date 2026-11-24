// Package awsemulator connects SDK clients to the rules_itest AWS Emulator service.
package awsemulator

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
)

// Config uses only the endpoint, certificate and keys of this test's emulator.
func Config(ctx context.Context) (aws.Config, error) {
	var ports struct {
		Emulator string `json:"@@//ts/pulumi/testing/emulator:service"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		return aws.Config{}, fmt.Errorf("read assigned emulator port: %w", err)
	}
	port, err := strconv.ParseUint(ports.Emulator, 10, 16)
	dir := os.Getenv("TEST_TMPDIR")
	if err != nil || port == 0 || dir == "" {
		return aws.Config{}, fmt.Errorf("AWS Emulator requires its assigned port and TEST_TMPDIR")
	}
	dir = filepath.Join(dir, "aws-emulator", ".aws", "emulator", ports.Emulator)
	profile, err := config.LoadSharedConfigProfile(ctx, "default", func(o *config.LoadSharedConfigOptions) {
		o.ConfigFiles = []string{}
		o.CredentialsFiles = []string{filepath.Join(dir, "emulator_credentials")}
	})
	if err != nil {
		return aws.Config{}, err
	}
	if !profile.Credentials.HasKeys() {
		return aws.Config{}, fmt.Errorf("no credentials for AWS Emulator")
	}
	certificate, err := os.ReadFile(filepath.Join(dir, "ca.pem"))
	if err != nil {
		return aws.Config{}, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(certificate) {
		return aws.Config{}, fmt.Errorf("invalid AWS Emulator CA")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.TLSClientConfig = &tls.Config{RootCAs: roots}
	return aws.Config{
		BaseEndpoint: aws.String("https://127.0.0.1:" + ports.Emulator),
		Region:       "us-east-1",
		Credentials:  credentials.StaticCredentialsProvider{Value: profile.Credentials},
		HTTPClient:   &http.Client{Transport: transport},
	}, nil
}
