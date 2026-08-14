package apiserver

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// JournalWorker transcribes uploaded audio and creates its cited entry summary.
// Scheduled invocations use it to finalize elapsed aggregate periods.
type JournalWorker struct {
	server *Server
}

func NewJournalWorker(ctx context.Context) (*JournalWorker, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	table := os.Getenv("JOURNAL_TABLE_NAME")
	bucket := os.Getenv("JOURNAL_BUCKET_NAME")
	identityProviderID := os.Getenv("OPENAI_IDENTITY_PROVIDER_ID")
	serviceAccountID := os.Getenv("OPENAI_SERVICE_ACCOUNT_ID")
	if table == "" || bucket == "" || identityProviderID == "" || serviceAccountID == "" {
		return nil, errors.New("JOURNAL_TABLE_NAME, JOURNAL_BUCKET_NAME, OPENAI_IDENTITY_PROVIDER_ID, and OPENAI_SERVICE_ACCOUNT_ID are required")
	}
	journalAI, err := newOpenAIJournalAIWithWorkloadIdentity(identityProviderID, serviceAccountID, sts.NewFromConfig(cfg))
	if err != nil {
		return nil, err
	}
	objects := s3.NewFromConfig(cfg)
	return &JournalWorker{server: &Server{
		ddb:               dynamodb.NewFromConfig(cfg),
		journalTableName:  table,
		journalBucketName: bucket,
		journalObjects:    objects,
		journalAI:         journalAI,
	}}, nil
}

func (w *JournalWorker) ProcessUpload(ctx context.Context, bucket, key string, size int64) error {
	return w.server.ProcessJournalUpload(ctx, bucket, key, size)
}

func (w *JournalWorker) RefreshSummaries(ctx context.Context, now time.Time) error {
	return w.server.RefreshJournalSummaries(ctx, now)
}
