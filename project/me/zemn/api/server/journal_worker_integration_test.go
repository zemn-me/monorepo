package apiserver

import (
	"bytes"
	"context"
	"io"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/zemn-me/monorepo/project/me/zemn/api/itestconfig"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

func TestDeployedWorkerDecodesLargeRecording(t *testing.T) {
	deployment, err := itestconfig.Load(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	objects := s3.NewFromConfig(deployment.AWS)
	server := Server{
		ddb:               dynamodb.NewFromConfig(deployment.AWS),
		journalTableName:  deployment.Environment["JOURNAL_TABLE_NAME"],
		journalObjects:    objects,
		journalPresigner:  s3.NewPresignClient(objects),
		journalBucketName: deployment.Environment["JOURNAL_BUCKET_NAME"],
	}
	ctx := context.WithValue(t.Context(), auth.IDTokenKey, &auth.IDToken{Issuer: "https://api.zemn.me", Subject: journalOwnerSubject})
	response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
		Body: &JournalEntryCreate{ContentType: "audio/wav", RecordedAt: time.Now().UTC(), TimeZone: "UTC"},
	})
	if err != nil {
		t.Fatal(err)
	}
	id := response.(PostJournalEntries201JSONResponse).Entry.Id.String()
	const duration = 13 * time.Minute
	audio, err := io.ReadAll(journalWAV(make([]byte, int(duration/time.Second)*journalPCMBytesPerSecond)))
	if err != nil {
		t.Fatal(err)
	}
	uploadJournalRecording(t, objects, server.journalBucketName, journalEntryKey(id), audio)

	// S3 delivers the completion event to the deployed worker. Only the FFmpeg
	// path computes the duration from decoded samples across transcription chunks.
	waitCtx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	for {
		records, err := server.listJournalRecords(waitCtx, journalOwnerSubject)
		if err != nil {
			t.Fatal(err)
		}
		entry, err := server.findJournalEntry(records, id)
		if err != nil {
			t.Fatal(err)
		}
		switch entry.Status {
		case JournalEntryStatusFailed:
			t.Fatal(entry.Error)
		case JournalEntryStatusReady:
			if entry.DurationMs != duration.Milliseconds() || len(entry.Transcript) == 0 {
				t.Fatalf("decoded %d ms with %d transcript segments", entry.DurationMs, len(entry.Transcript))
			}
			return
		}
		select {
		case <-waitCtx.Done():
			t.Fatalf("worker left entry %s in state %s", id, entry.Status)
		case <-time.After(250 * time.Millisecond):
		}
	}
}

// The emulator limits requests to 16 MiB. Completing a multipart upload exercises
// the bucket notification with a recording larger than one transcription request.
func uploadJournalRecording(t *testing.T, objects *s3.Client, bucket, key string, audio []byte) {
	t.Helper()
	upload, err := objects.CreateMultipartUpload(t.Context(), &s3.CreateMultipartUploadInput{
		Bucket: &bucket, Key: &key, ContentType: aws.String("audio/wav"),
	})
	if err != nil {
		t.Fatal(err)
	}
	var parts []types.CompletedPart
	for len(audio) > 0 {
		n := min(12<<20, len(audio))
		number := int32(len(parts) + 1)
		part, err := objects.UploadPart(t.Context(), &s3.UploadPartInput{
			Bucket: &bucket, Key: &key, UploadId: upload.UploadId, PartNumber: &number, Body: bytes.NewReader(audio[:n]),
		})
		if err != nil {
			t.Fatal(err)
		}
		parts = append(parts, types.CompletedPart{PartNumber: &number, ETag: part.ETag})
		audio = audio[n:]
	}
	_, err = objects.CompleteMultipartUpload(t.Context(), &s3.CompleteMultipartUploadInput{
		Bucket: &bucket, Key: &key, UploadId: upload.UploadId, MultipartUpload: &types.CompletedMultipartUpload{Parts: parts},
	})
	if err != nil {
		t.Fatal(err)
	}
}
