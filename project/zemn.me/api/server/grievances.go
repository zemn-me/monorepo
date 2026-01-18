package apiserver

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

type grievanceRecord struct {
	Id          string `dynamodbav:"id"`
	Name        string `dynamodbav:"name"`
	Description string `dynamodbav:"description"`
	Priority    int    `dynamodbav:"priority"`
	Created     Time   `dynamodbav:"created"`
	TimeZone    string `dynamodbav:"time_zone"`
	PosterEmail string `dynamodbav:"poster_email"`
}

var errGrievanceNotFound = errors.New("grievance not found")

func grievanceFromRecord(r grievanceRecord) api_types.Grievance {
	uid := uuid.MustParse(r.Id)
	id := openapi_types.UUID(uid)
	var tz *string
	if r.TimeZone != "" {
		tzVal := r.TimeZone
		tz = &tzVal
	}
	var posterEmail *string
	if r.PosterEmail != "" {
		posterEmailVal := r.PosterEmail
		posterEmail = &posterEmailVal
	}
	return api_types.Grievance{
		Id:          &id,
		Name:        r.Name,
		Description: r.Description,
		Priority:    r.Priority,
		Created:     r.Created.Time,
		TimeZone:    tz,
		PosterEmail: posterEmail,
	}
}

func resolveTimeZone(requested *string, fallback string) (string, *time.Location, error) {
	tzName := fallback
	if requested != nil && *requested != "" {
		tzName = *requested
	}
	if tzName == "" {
		tzName = "UTC"
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return "", nil, err
	}
	return tzName, loc, nil
}

func (s Server) listGrievances(ctx context.Context) ([]api_types.Grievance, error) {
	out, err := s.ddb.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(s.grievancesTableName),
	})
	if err != nil {
		return nil, err
	}
	var recs []grievanceRecord
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &recs); err != nil {
		return nil, err
	}
	gs := make([]api_types.Grievance, 0, len(recs))
	for _, r := range recs {
		gs = append(gs, grievanceFromRecord(r))
	}
	return gs, nil
}

func (s Server) createGrievance(ctx context.Context, g api_types.NewGrievance) (api_types.Grievance, error) {
	tzName, tzLoc, err := resolveTimeZone(g.TimeZone, "")
	if err != nil {
		return api_types.Grievance{}, err
	}

	posterEmail := ""
	if token, ok := auth.IdTokenFromContext(ctx); ok && token.Email != nil {
		posterEmail = *token.Email
	}

	id := uuid.New()
	created := Now()
	created.Time = created.Time.In(tzLoc)
	rec := grievanceRecord{
		Id:          id.String(),
		Name:        g.Name,
		Description: g.Description,
		Priority:    g.Priority,
		Created:     created,
		TimeZone:    tzName,
		PosterEmail: posterEmail,
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return api_types.Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
	return grievanceFromRecord(rec), err
}

func (s Server) updateGrievance(ctx context.Context, id string, g api_types.NewGrievance) (api_types.Grievance, error) {
	existing, err := s.getGrievance(ctx, id)
	if err != nil {
		return api_types.Grievance{}, err
	}
	if existing == nil {
		return api_types.Grievance{}, errGrievanceNotFound
	}
	var currentTZ string
	if existing.TimeZone != nil {
		currentTZ = *existing.TimeZone
	}
	var posterEmail string
	if existing.PosterEmail != nil {
		posterEmail = *existing.PosterEmail
	}
	tzName, _, err := resolveTimeZone(g.TimeZone, currentTZ)
	if err != nil {
		return api_types.Grievance{}, err
	}
	rec := grievanceRecord{
		Id:          id,
		Name:        g.Name,
		Description: g.Description,
		Priority:    g.Priority,
		Created:     Time{Time: existing.Created},
		TimeZone:    tzName,
		PosterEmail: posterEmail,
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return api_types.Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
	return grievanceFromRecord(rec), err
}

func (s Server) getGrievance(ctx context.Context, id string) (*api_types.Grievance, error) {
	out, err := s.ddb.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.grievancesTableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return nil, err
	}
	if out.Item == nil {
		return nil, nil
	}
	var rec grievanceRecord
	if err := attributevalue.UnmarshalMap(out.Item, &rec); err != nil {
		return nil, err
	}
	g := grievanceFromRecord(rec)
	return &g, nil
}

func (s Server) deleteGrievance(ctx context.Context, id string) error {
	_, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.grievancesTableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	})
	return err
}

// Handler implementations

func (s Server) GetGrievances(ctx context.Context, rq api_types.GetGrievancesRequestObject) (api_types.GetGrievancesResponseObject, error) {
	list, err := s.listGrievances(ctx)
	if err != nil {
		return nil, err
	}
	return api_types.GetGrievances200JSONResponse(list), nil
}

func (s Server) PostGrievances(ctx context.Context, rq api_types.PostGrievancesRequestObject) (api_types.PostGrievancesResponseObject, error) {
	g, err := s.createGrievance(ctx, *rq.Body)
	if err != nil {
		return nil, err
	}
	return api_types.PostGrievances200JSONResponse(g), nil
}

func (s Server) GetGrievanceId(ctx context.Context, rq api_types.GetGrievanceIdRequestObject) (api_types.GetGrievanceIdResponseObject, error) {
	g, err := s.getGrievance(ctx, rq.Id)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	return api_types.GetGrievanceId200JSONResponse(*g), nil
}

func (s Server) PutGrievanceId(ctx context.Context, rq api_types.PutGrievanceIdRequestObject) (api_types.PutGrievanceIdResponseObject, error) {
	g, err := s.updateGrievance(ctx, rq.Id, *rq.Body)
	if err == errGrievanceNotFound {
		return api_types.PutGrievanceId404Response{}, nil
	}
	if err != nil {
		return nil, err
	}
	return api_types.PutGrievanceId200JSONResponse(g), nil
}

func (s Server) DeleteGrievanceId(ctx context.Context, rq api_types.DeleteGrievanceIdRequestObject) (api_types.DeleteGrievanceIdResponseObject, error) {
	if err := s.deleteGrievance(ctx, rq.Id); err != nil {
		return nil, err
	}
	return api_types.DeleteGrievanceId200JSONResponse("ok"), nil
}
