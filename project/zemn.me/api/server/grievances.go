package apiserver

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

type grievanceRecord struct {
	Id          string                 `dynamodbav:"id"`
	Name        *string                `dynamodbav:"name,omitempty"`
	Poster      *grievancePosterRecord `dynamodbav:"poster,omitempty"`
	Description string                 `dynamodbav:"description"`
	Priority    int                    `dynamodbav:"priority"`
	Created     Time                   `dynamodbav:"created"`
	TimeZone    string                 `dynamodbav:"time_zone"`
}

type grievancePosterRecord struct {
	Sub        string  `dynamodbav:"sub"`
	Email      *string `dynamodbav:"email_address,omitempty"`
	GivenName  *string `dynamodbav:"given_name,omitempty"`
	FamilyName *string `dynamodbav:"family_name,omitempty"`
}

var errGrievanceNotFound = errors.New("grievance not found")

func grievanceFromRecord(r grievanceRecord) Grievance {
	uid := uuid.MustParse(r.Id)
	id := openapi_types.UUID(uid)
	var tz *string
	if r.TimeZone != "" {
		tzVal := r.TimeZone
		tz = &tzVal
	}
	return Grievance{
		Id:   &id,
		Name: r.Name,
		Poster: func() *GrievancePoster {
			if r.Poster == nil || r.Poster.Sub == "" {
				return nil
			}
			poster := GrievancePoster{
				Sub: r.Poster.Sub,
			}
			if r.Poster.Email != nil {
				email := openapi_types.Email(*r.Poster.Email)
				poster.EmailAddress = &email
			}
			if r.Poster.GivenName != nil {
				poster.GivenName = r.Poster.GivenName
			}
			if r.Poster.FamilyName != nil {
				poster.FamilyName = r.Poster.FamilyName
			}
			return &poster
		}(),
		Description: r.Description,
		Priority:    r.Priority,
		Created:     r.Created.Time,
		TimeZone:    tz,
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

func (s Server) listGrievances(ctx context.Context) ([]Grievance, error) {
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
	gs := make([]Grievance, 0, len(recs))
	for _, r := range recs {
		gs = append(gs, grievanceFromRecord(r))
	}
	return gs, nil
}

func (s Server) createGrievance(ctx context.Context, g NewGrievance) (Grievance, error) {
	sub, _ := auth.SubjectFromContext(ctx)
	posterEmail, _ := auth.EmailFromContext(ctx)
	givenName, _ := auth.GivenNameFromContext(ctx)
	familyName, _ := auth.FamilyNameFromContext(ctx)
	tzName, tzLoc, err := resolveTimeZone(g.TimeZone, "")
	if err != nil {
		return Grievance{}, err
	}
	var name *string
	if g.Name != nil {
		trimmed := strings.TrimSpace(*g.Name)
		if trimmed != "" {
			name = &trimmed
		}
	}
	var poster *grievancePosterRecord
	if sub != "" {
		poster = &grievancePosterRecord{
			Sub: sub,
		}
		if posterEmail != "" {
			poster.Email = &posterEmail
		}
		if givenName != "" {
			poster.GivenName = &givenName
		}
		if familyName != "" {
			poster.FamilyName = &familyName
		}
	}

	id := uuid.New()
	created := Now()
	created.Time = created.Time.In(tzLoc)
	rec := grievanceRecord{
		Id:          id.String(),
		Name:        name,
		Poster:      poster,
		Description: g.Description,
		Priority:    g.Priority,
		Created:     created,
		TimeZone:    tzName,
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
	return grievanceFromRecord(rec), err
}

func (s Server) updateGrievance(ctx context.Context, id string, g NewGrievance) (Grievance, error) {
	existing, err := s.getGrievance(ctx, id)
	if err != nil {
		return Grievance{}, err
	}
	if existing == nil {
		return Grievance{}, errGrievanceNotFound
	}
	var currentTZ string
	if existing.TimeZone != nil {
		currentTZ = *existing.TimeZone
	}
	tzName, _, err := resolveTimeZone(g.TimeZone, currentTZ)
	if err != nil {
		return Grievance{}, err
	}
	var name *string
	if existing != nil && existing.Name != nil {
		existingName := strings.TrimSpace(*existing.Name)
		if existingName != "" {
			name = &existingName
		}
	}
	if g.Name != nil {
		trimmed := strings.TrimSpace(*g.Name)
		if trimmed == "" {
			name = nil
		} else {
			name = &trimmed
		}
	}
	var poster *grievancePosterRecord
	if existing != nil && existing.Poster != nil {
		poster = &grievancePosterRecord{
			Sub: existing.Poster.Sub,
		}
		if existing.Poster.EmailAddress != nil {
			email := string(*existing.Poster.EmailAddress)
			poster.Email = &email
		}
		if existing.Poster.GivenName != nil {
			poster.GivenName = existing.Poster.GivenName
		}
		if existing.Poster.FamilyName != nil {
			poster.FamilyName = existing.Poster.FamilyName
		}
	}
	rec := grievanceRecord{
		Id:          id,
		Name:        name,
		Poster:      poster,
		Description: g.Description,
		Priority:    g.Priority,
		Created:     Time{Time: existing.Created},
		TimeZone:    tzName,
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
	return grievanceFromRecord(rec), err
}

func (s Server) getGrievance(ctx context.Context, id string) (*Grievance, error) {
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

func (s Server) GetGrievances(ctx context.Context, rq GetGrievancesRequestObject) (GetGrievancesResponseObject, error) {
	list, err := s.listGrievances(ctx)
	if err != nil {
		return nil, err
	}
	return GetGrievances200JSONResponse(list), nil
}

func (s Server) PostGrievances(ctx context.Context, rq PostGrievancesRequestObject) (PostGrievancesResponseObject, error) {
	g, err := s.createGrievance(ctx, *rq.Body)
	if err != nil {
		return nil, err
	}
	return PostGrievances200JSONResponse(g), nil
}

func (s Server) GetGrievanceId(ctx context.Context, rq GetGrievanceIdRequestObject) (GetGrievanceIdResponseObject, error) {
	g, err := s.getGrievance(ctx, rq.Id)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	return GetGrievanceId200JSONResponse(*g), nil
}

func (s Server) PutGrievanceId(ctx context.Context, rq PutGrievanceIdRequestObject) (PutGrievanceIdResponseObject, error) {
	g, err := s.updateGrievance(ctx, rq.Id, *rq.Body)
	if err == errGrievanceNotFound {
		return PutGrievanceId404Response{}, nil
	}
	if err != nil {
		return nil, err
	}
	return PutGrievanceId200JSONResponse(g), nil
}

func (s Server) DeleteGrievanceId(ctx context.Context, rq DeleteGrievanceIdRequestObject) (DeleteGrievanceIdResponseObject, error) {
	if err := s.deleteGrievance(ctx, rq.Id); err != nil {
		return nil, err
	}
	return DeleteGrievanceId200JSONResponse("ok"), nil
}
