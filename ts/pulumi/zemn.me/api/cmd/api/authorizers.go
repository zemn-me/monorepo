package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const (
	TableName         = "CallboxAuthorizers"  // Ensure your table exists.
	PartitionKeyValue = "CALLBOX_AUTHORIZERS" // Fixed partition key.
)

// getLatestAuthorizers retrieves the most recent record of authorizers.
func (s Server) getLatestAuthorizers(ctx context.Context) ([]string, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.tableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: PartitionKeyValue},
		},
		ScanIndexForward: aws.Bool(false), // Latest first.
		Limit:            aws.Int32(1),
	}
	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return nil, err
	}
	if len(result.Items) == 0 {
		return []string{}, nil
	}
	if attr, ok := result.Items[0]["authorizers"]; ok {
		if ss, ok := attr.(*types.AttributeValueMemberSS); ok {
			return ss.Value, nil
		}
	}
	return []string{}, nil
}

// putNewAuthorizers writes a new record with the updated list and current timestamp.
func (s Server) putNewAuthorizers(ctx context.Context, list []string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	input := &dynamodb.PutItemInput{
		TableName: aws.String(s.tableName),
		Item: map[string]types.AttributeValue{
			"id":          &types.AttributeValueMemberS{Value: PartitionKeyValue},
			"date":        &types.AttributeValueMemberS{Value: now},
			"authorizers": &types.AttributeValueMemberSS{Value: list},
		},
	}
	_, err := s.ddb.PutItem(ctx, input)
	return err
}

// getCallboxAuthorizers is the unexported version of GET /callbox/authorizers.
func (s Server) getCallboxAuthorizers(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	list, err := s.getLatestAuthorizers(ctx)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(list)
}

// GetCallboxAuthorizers is the exported handler for GET /callbox/authorizers.
func (s Server) GetCallboxAuthorizers(w http.ResponseWriter, r *http.Request) {
	if err := s.getCallboxAuthorizers(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}

// patchCallboxAuthorizers is the unexported version of PATCH /callbox/authorizers.
func (s Server) patchCallboxAuthorizers(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	var req PhoneNumberPatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return fmt.Errorf("invalid request: %w", err)
	}

	// Retrieve current authorizers.
	currentList, err := s.getLatestAuthorizers(ctx)
	if err != nil {
		return err
	}
	currentMap := make(map[string]bool)
	for _, num := range currentList {
		currentMap[num] = true
	}
	// Process additions.
	if req.Add != nil {
		for _, num := range *req.Add {
			currentMap[num] = true
		}
	}
	// Process removals.
	if req.Remove != nil {
		for _, num := range *req.Remove {
			delete(currentMap, num)
		}
	}
	// Rebuild the list.
	newList := []string{}
	for num := range currentMap {
		newList = append(newList, num)
	}
	// Append a new record with the updated list.
	if err := s.putNewAuthorizers(ctx, newList); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(newList)
}

// PatchCallboxAuthorizers is the exported handler for PATCH /callbox/authorizers.
func (s Server) PatchCallboxAuthorizers(w http.ResponseWriter, r *http.Request) {
	if err := s.patchCallboxAuthorizers(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
