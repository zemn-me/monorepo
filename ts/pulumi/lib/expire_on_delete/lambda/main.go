// Package main implements an AWS Lambda function that handles S3 delete marker events.
// This function removes delete markers and sets expiration tags on versioned objects.
// It is intended for use in scenarios such as managing a CDN backing store where objects
// need to be retained for a short period after delete markers are created, ensuring proper
// propagation of updates before objects are fully expired.
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

const expirationDays = 7

type S3EventRecord struct {
	BucketName string
	ObjectKey  string
	VersionID  string
}

func handleRequest(ctx context.Context, event events.S3Event) (map[string]string, error) {
	sess := session.Must(session.NewSession())
	s3Client := s3.New(sess)

	// Extract bucket name, object key, and version ID from the event
	record := event.Records[0]
	bucketName := record.S3.Bucket.Name
	objectKey := record.S3.Object.Key
	versionID := record.S3.Object.VersionID

	// Check if this event corresponds to a delete marker
	headObjectInput := &s3.HeadObjectInput{
		Bucket:    aws.String(bucketName),
		Key:       aws.String(objectKey),
		VersionId: aws.String(versionID),
	}

	headObjectOutput, err := s3Client.HeadObject(headObjectInput)
	if err != nil {
		log.Printf("Error getting object metadata for %s: %v", objectKey, err)
		return map[string]string{
			"statusCode": "500",
			"body":       fmt.Sprintf("Error: %v", err),
		}, err
	}

	if aws.BoolValue(headObjectOutput.DeleteMarker) {
		// Remove the delete marker
		deleteObjectInput := &s3.DeleteObjectInput{
			Bucket:    aws.String(bucketName),
			Key:       aws.String(objectKey),
			VersionId: aws.String(versionID),
		}

		_, err := s3Client.DeleteObject(deleteObjectInput)
		if err != nil {
			log.Printf("Error removing delete marker for %s: %v", objectKey, err)
			return map[string]string{
				"statusCode": "500",
				"body":       fmt.Sprintf("Error: %v", err),
			}, err
		}
		log.Printf("Removed delete marker for %s in %s", objectKey, bucketName)

		// Calculate the expiration date
		expirationDate := time.Now().Add(expirationDays * 24 * time.Hour).Format(time.RFC3339)

		// Add an expiration tag to the object
		taggingInput := &s3.PutObjectTaggingInput{
			Bucket: aws.String(bucketName),
			Key:    aws.String(objectKey),
			Tagging: &s3.Tagging{
				TagSet: []*s3.Tag{
					{
						Key:   aws.String("ExpireOn"),
						Value: aws.String(expirationDate),
					},
				},
			},
		}

		_, err = s3Client.PutObjectTagging(taggingInput)
		if err != nil {
			log.Printf("Error setting expiration tag for %s: %v", objectKey, err)
			return map[string]string{
				"statusCode": "500",
				"body":       fmt.Sprintf("Error: %v", err),
			}, err
		}
		log.Printf("Set expiration tag for %s to %s", objectKey, expirationDate)

		return map[string]string{
			"statusCode": "200",
			"body":       fmt.Sprintf("Removed delete marker and set expiration for %s.", objectKey),
		}, nil
	}

	return map[string]string{
		"statusCode": "200",
		"body":       "No action needed.",
	}, nil
}

func main() {
	lambda.Start(handleRequest)
}
