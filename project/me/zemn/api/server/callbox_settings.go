package apiserver

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const (
	PartitionKeyValue = "CALLBOX_SETTINGS_2" // Fixed partition key.
)

type SettingsRecord struct {
	Id       string          `dynamodbav:"id"` // caps needed
	When     Time            `dynamodbav:"when"`
	Settings CallboxSettings `dynamodbav:"settings"`
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

	set = new(SettingsRecord)

	if err = attributevalue.UnmarshalMap(result.Items[0], set); err != nil {
		return
	}

	return
}

func (s *Server) inPartyMode(ctx context.Context) (inPartyMode bool, err error) {
	settings, err := s.getLatestSettings(ctx)
	if err != nil {
		return
	}

	if settings == nil {
		return false, nil
	}

	inPartyMode = settings.Settings.PartyMode != nil && *settings.Settings.PartyMode
	return
}

func (s *Server) getLatestEntryCodes(ctx context.Context) (entryCodes []EntryCodeEntry, err error) {
	settings, err := s.getLatestSettings(ctx)
	if err != nil {
		return
	}

	return settings.Settings.EntryCodes, nil
}

func (s *Server) getLatestAuthorizers(ctx context.Context) (authorizers []Authorizer, err error) {
	settings, err := s.getLatestSettings(ctx)
	if err != nil {
		return
	}

	return settings.Settings.Authorizers, nil
}

// postNewSettings writes a new callbox settings record with the current timestamp.
func (s Server) postNewSettings(ctx context.Context, settings CallboxSettings) (err error) {
	rec := SettingsRecord{
		Id:       PartitionKeyValue,
		When:     Now(),
		Settings: settings,
	}

	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(s.settingsTableName),
		Item:      item,
	}
	_, err = s.ddb.PutItem(ctx, input)
	return err
}

var _ StrictServerInterface = (*Server)(nil)

// getCallboxSettings handles GET /callbox/settings.
func (s Server) GetCallboxSettings(ctx context.Context, rq GetCallboxSettingsRequestObject) (rs GetCallboxSettingsResponseObject, err error) {
	rec, err := s.getLatestSettings(ctx)
	if err != nil {
		return
	}

	// blank / default settings
	var settings CallboxSettings
	if rec != nil {
		settings = rec.Settings
	}

	return GetCallboxSettings200JSONResponse(settings), nil
}

// postCallboxSettings handles POST /callbox/settings.
func (s Server) PostCallboxSettings(ctx context.Context, rq PostCallboxSettingsRequestObject) (rs PostCallboxSettingsResponseObject, err error) {
	// Write the new settings record.
	if err = s.postNewSettings(ctx, *rq.Body); err != nil {
		return
	}

	return PostCallboxSettings200JSONResponse(
		*rq.Body,
	), nil
}
