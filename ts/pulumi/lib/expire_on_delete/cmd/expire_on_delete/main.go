// One part of a two-part system which expires objects in an S3 bucket after
// some time instead of deleting them.
//
// This is to remedy the case in which an update to an index.html etc file is
// not percolated to the CDN yet, so it serves an old version of the file with
// references to now removed content-addressible objects.
//
// You can set a lifecycle policy to delete objects with the "expire_on_delete"
// tag once this is set up.
package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

func main() {
	lambda.Start(Handler)
}

// Handler is the Lambda function entry point
func Handler(ctx context.Context, s3Event events.S3Event) error {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	client := s3.NewFromConfig(cfg)

	for _, record := range s3Event.Records {
		bucket := record.S3.Bucket.Name
		key := record.S3.Object.Key

		if err := processDeletedObject(ctx, client, bucket, key); err != nil {
			return err
		}
	}

	return nil
}

// processDeletedObject handles soft deletion logic
func processDeletedObject(ctx context.Context, client *s3.Client, bucket, key string) error {
	_, err := client.PutObjectTagging(ctx, &s3.PutObjectTaggingInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Tagging: &types.Tagging{
			TagSet: []types.Tag{
				{Key: aws.String("expire_on_delete"), Value: aws.String("true")},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to tag object as soft-deleted: %w", err)
	}

	versionOutput, err := client.ListObjectVersions(ctx, &s3.ListObjectVersionsInput{
		Bucket: aws.String(bucket),
		Prefix: aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to list object versions: %w", err)
	}

	for _, marker := range versionOutput.DeleteMarkers {
		if *marker.Key == key && *marker.IsLatest {
			_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket:    aws.String(bucket),
				Key:       aws.String(key),
				VersionId: marker.VersionId,
			})
			if err != nil {
				return fmt.Errorf("failed to delete marker: %w", err)
			}
		}
	}

	return nil
}
