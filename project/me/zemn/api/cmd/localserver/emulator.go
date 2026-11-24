package main

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

// Keep the browser's real SigV4 playback URLs short-lived so the journal
// exercises recovery from an expired URL within one browser session.
type browserPresigner struct{ *s3.PresignClient }

func (p browserPresigner) PresignGetObject(ctx context.Context, input *s3.GetObjectInput, options ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	return p.PresignClient.PresignGetObject(ctx, input, append(options, func(o *s3.PresignOptions) { o.Expires = 8 * time.Second })...)
}

func configureEmulatedJournal(ctx context.Context, cfg aws.Config, apiOrigin string, mux *http.ServeMux, opts *apiserver.NewServerOptions) error {
	bucket := os.Getenv("JOURNAL_BUCKET_NAME")
	objects := s3.NewFromConfig(cfg, func(o *s3.Options) { o.UsePathStyle = true })

	opts.JournalObjects = objects
	opts.JournalPresigner = browserPresigner{s3.NewPresignClient(objects, func(o *s3.PresignOptions) {
		o.ClientOptions = append(o.ClientOptions, func(o *s3.Options) { o.BaseEndpoint = &apiOrigin })
	})}

	cors, err := objects.GetBucketCors(ctx, &s3.GetBucketCorsInput{Bucket: &bucket})
	if err != nil {
		return err
	}
	return mountBrowserObjects(cfg, bucket, cors.CORSRules, mux)
}

func mountBrowserObjects(cfg aws.Config, bucket string, cors []s3types.CORSRule, mux *http.ServeMux) error {
	// Browsers cannot use the emulator's private CA and its control-plane
	// endpoint does not support S3 browser preflights. Forward only signed
	// journal object traffic, preserving the signed Host, query and Range.
	upstream, err := url.Parse(*cfg.BaseEndpoint)
	if err != nil {
		return err
	}
	proxy := httputil.ReverseProxy{
		Transport: cfg.HTTPClient.(*http.Client).Transport,
		Rewrite: func(r *httputil.ProxyRequest) {
			r.Out.URL.Scheme, r.Out.URL.Host = upstream.Scheme, upstream.Host
			r.Out.Header = http.Header{}
			for _, name := range []string{"Content-Type", "If-None-Match", "Range", "If-Range"} {
				if value := r.In.Header.Get(name); value != "" {
					r.Out.Header.Set(name, value)
				}
			}
		},
	}
	objectPath := "/" + bucket + "/entries/{id}/source"
	origin := os.Getenv("OAUTH_FRONTEND_ORIGIN")
	mux.HandleFunc(objectPath, func(w http.ResponseWriter, r *http.Request) {
		method := r.Method
		if method == http.MethodOptions {
			method = r.Header.Get("Access-Control-Request-Method")
		}
		// Map the assigned frontend port to the local origin declared on the bucket.
		if r.Header.Get("Origin") == origin {
			for _, rule := range cors {
				if !slices.Contains(rule.AllowedOrigins, "http://localhost:3000") && !slices.Contains(rule.AllowedOrigins, "*") {
					continue
				}
				if !slices.Contains(rule.AllowedMethods, method) {
					continue
				}
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(rule.AllowedMethods, ", "))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(rule.AllowedHeaders, ", "))
				w.Header().Set("Access-Control-Expose-Headers", strings.Join(rule.ExposeHeaders, ", "))
				break
			}
		}
		switch r.Method {
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		case http.MethodGet, http.MethodPut:
			if r.URL.Query().Get("X-Amz-Signature") == "" {
				http.Error(w, "expected a presigned S3 request", http.StatusForbidden)
				return
			}
			proxy.ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	return nil
}
