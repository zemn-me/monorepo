package main

import (
	"context"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	kmstypes "github.com/aws/aws-sdk-go-v2/service/kms/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	sqstypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

func configureEmulatedSigningKey(ctx context.Context, cfg aws.Config) error {
	client := kms.NewFromConfig(cfg)
	key, err := client.CreateKey(ctx, &kms.CreateKeyInput{
		KeySpec:  kmstypes.KeySpecEccNistP256,
		KeyUsage: kmstypes.KeyUsageTypeSignVerify,
	})
	if err != nil {
		return err
	}
	public, err := client.GetPublicKey(ctx, &kms.GetPublicKeyInput{KeyId: key.KeyMetadata.KeyId})
	if err != nil {
		return err
	}
	mustSetEnv("OIDC_JWT_KMS_KEY_ID", aws.ToString(key.KeyMetadata.KeyId))
	mustSetEnv("OIDC_JWT_PUBLIC_KEY", string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public.PublicKey})))
	return nil
}

// Keep the browser's real SigV4 playback URLs short-lived so the journal
// exercises recovery from an expired URL within one browser session.
type browserPresigner struct{ *s3.PresignClient }

func (p browserPresigner) PresignGetObject(ctx context.Context, input *s3.GetObjectInput, options ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	return p.PresignClient.PresignGetObject(ctx, input, append(options, func(o *s3.PresignOptions) { o.Expires = 8 * time.Second })...)
}

func configureEmulatedJournal(ctx context.Context, cfg aws.Config, apiOrigin string, mux *http.ServeMux, opts *apiserver.NewServerOptions) (func(*apiserver.Server), error) {
	bucket := os.Getenv("JOURNAL_BUCKET_NAME")
	objects := s3.NewFromConfig(cfg, func(o *s3.Options) { o.UsePathStyle = true })
	if _, err := objects.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &bucket}); err != nil {
		return nil, err
	}
	queue := sqs.NewFromConfig(cfg)
	queueURL, err := subscribeJournalUploads(ctx, queue, objects, bucket)
	if err != nil {
		return nil, err
	}

	opts.JournalObjects = objects
	opts.JournalPresigner = browserPresigner{s3.NewPresignClient(objects, func(o *s3.PresignOptions) {
		o.ClientOptions = append(o.ClientOptions, func(o *s3.Options) { o.BaseEndpoint = &apiOrigin })
	})}

	if err := mountBrowserObjects(cfg, bucket, mux); err != nil {
		return nil, err
	}
	return func(srv *apiserver.Server) {
		go func() {
			if err := consumeJournalUploads(ctx, queue, queueURL, srv); err != nil {
				log.Fatalf("journal notification consumer: %v", err)
			}
		}()
	}, nil
}

func mountBrowserObjects(cfg aws.Config, bucket string, mux *http.ServeMux) error {
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
		w.Header().Set("Access-Control-Allow-Origin", origin)
		switch r.Method {
		case http.MethodOptions:
			w.Header().Set("Access-Control-Allow-Methods", "GET, PUT")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, If-None-Match")
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

// The emulator delivers real S3 notifications to SQS. The local process runs
// the upload worker that Lambda invokes in production.
func subscribeJournalUploads(ctx context.Context, queue *sqs.Client, objects *s3.Client, bucket string) (string, error) {
	created, err := queue.CreateQueue(ctx, &sqs.CreateQueueInput{QueueName: aws.String("journal-uploads")})
	if err != nil {
		return "", err
	}
	attrs, err := queue.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
		QueueUrl:       created.QueueUrl,
		AttributeNames: []sqstypes.QueueAttributeName{sqstypes.QueueAttributeNameQueueArn},
	})
	if err != nil {
		return "", err
	}
	arn := attrs.Attributes["QueueArn"]
	if arn == "" {
		return "", errors.New("journal queue has no ARN")
	}
	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [{
			"Effect": "Allow",
			"Principal": {"Service": "s3.amazonaws.com"},
			"Action": "sqs:SendMessage",
			"Resource": %q,
			"Condition": {"ArnEquals": {"aws:SourceArn": %q}}
		}]
	}`, arn, "arn:aws:s3:::"+bucket)
	_, err = queue.SetQueueAttributes(ctx, &sqs.SetQueueAttributesInput{
		QueueUrl:   created.QueueUrl,
		Attributes: map[string]string{"Policy": policy},
	})
	if err != nil {
		return "", err
	}
	filter := s3types.S3KeyFilter{FilterRules: []s3types.FilterRule{
		{Name: s3types.FilterRuleNamePrefix, Value: aws.String("entries/")},
		{Name: s3types.FilterRuleNameSuffix, Value: aws.String("/source")},
	}}
	_, err = objects.PutBucketNotificationConfiguration(ctx, &s3.PutBucketNotificationConfigurationInput{
		Bucket: &bucket,
		NotificationConfiguration: &s3types.NotificationConfiguration{
			QueueConfigurations: []s3types.QueueConfiguration{{
				QueueArn: &arn,
				Events:   []s3types.Event{s3types.EventS3ObjectCreated},
				Filter:   &s3types.NotificationConfigurationFilter{Key: &filter},
			}},
		},
	})
	return aws.ToString(created.QueueUrl), err
}

func consumeJournalUploads(ctx context.Context, queue *sqs.Client, queueURL string, srv *apiserver.Server) error {
	for {
		messages, err := queue.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{QueueUrl: &queueURL, WaitTimeSeconds: 10, VisibilityTimeout: 600})
		if err != nil {
			return err
		}
		for _, message := range messages.Messages {
			if err := processJournalNotification(ctx, aws.ToString(message.Body), srv); err != nil {
				// Leave failed deliveries available for retry after the visibility timeout.
				log.Printf("process journal notification %s: %v", aws.ToString(message.MessageId), err)
				continue
			}
			if _, err := queue.DeleteMessage(ctx, &sqs.DeleteMessageInput{QueueUrl: &queueURL, ReceiptHandle: message.ReceiptHandle}); err != nil {
				return err
			}
		}
	}
}

func processJournalNotification(ctx context.Context, body string, srv *apiserver.Server) error {
	var event events.S3Event
	if err := json.Unmarshal([]byte(body), &event); err != nil {
		return err
	}
	// Installing the notification also delivers an s3:TestEvent with no records.
	for _, record := range event.Records {
		if err := srv.ProcessJournalUpload(ctx, record.S3.Bucket.Name, record.S3.Object.URLDecodedKey, record.S3.Object.Size); err != nil {
			return err
		}
	}
	return nil
}
