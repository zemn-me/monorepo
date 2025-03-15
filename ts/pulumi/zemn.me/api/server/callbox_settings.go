package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const (
	PartitionKeyValue = "CALLBOX_SETTINGS" // Fixed partition key.
)

type SettingsRecord struct {
	Id       UUID
	When     Time
	Settings CallboxSettings
}

// getLatestSettings retrieves the most recent callbox settings record.
func (s Server) getLatestSettings(ctx context.Context) (set *SettingsRecord, err error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.settingsTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: PartitionKeyValue},
		},
		ScanIndexForward: aws.Bool(false), // Latest record first.
		Limit:            aws.Int32(1),
	}

	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return
	}

	if len(result.Items) == 0 {
		// no result
		return
	}

	if err = attributevalue.Unmarshal(result.Items[0], set); err != nil {
		return
	}

	return
}

// postNewSettings writes a new callbox settings record with the current timestamp.
func (s Server) postNewSettings(ctx context.Context, settings CallboxSettings) (err error) {
	rec := SettingsRecord{
		Id:       NewUUID(),
		When:     Now(),
		Settings: settings,
	}

	item, err := attributevalue.Marshal(rec)
	if err != nil {
		return
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(s.settingsTableName),
		Item:      item,
	}
	_, err := s.ddb.PutItem(ctx, input)
	return err
}

// getCallboxSettings handles GET /callbox/settings.
func (s Server) getCallboxSettings(w http.ResponseWriter, r *http.Request) error {
	if err := useOIDCAuth(w, r); err != nil {
		return err
	}
	ctx := r.Context()
	rec, err := s.getLatestSettings(ctx)
	if err != nil {
		return err
	}

	// blank / default settings
	var settings CallboxSettings
	if rec != nil {
		settings = rec.Settings
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(settings)
}

// GetCallboxSettings is the exported handler for GET /callbox/settings.
func (s Server) GetCallboxSettings(w http.ResponseWriter, r *http.Request) {
	if err := s.getCallboxSettings(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}

// postCallboxSettings handles POST /callbox/settings.
func (s Server) postCallboxSettings(w http.ResponseWriter, r *http.Request) error {
	if err := useOIDCAuth(w, r); err != nil {
		return err
	}
	ctx := r.Context()
	var req CallboxSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return fmt.Errorf("invalid request: %w", err)
	}

	// Write the new settings record.
	if err := s.postNewSettings(ctx, req); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(req)
}

// PostCallboxSettings is the exported handler for POST /callbox/settings.
func (s Server) PostCallboxSettings(w http.ResponseWriter, r *http.Request) {
	if err := s.postCallboxSettings(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
