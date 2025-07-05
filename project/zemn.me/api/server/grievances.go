package apiserver

import (
	"context"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

type grievanceRecord struct {
        Id          string `dynamodbav:"id"`
        Name        string `dynamodbav:"name"`
        Description string `dynamodbav:"description"`
        Priority    int    `dynamodbav:"priority"`
        Created     Time    `dynamodbav:"created"`
}

var errGrievanceNotFound = errors.New("grievance not found")

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
               uid := uuid.MustParse(r.Id)
               id := openapi_types.UUID(uid)
               gs = append(gs, Grievance{
                       Id:          &id,
                       Name:        r.Name,
                       Description: r.Description,
                       Priority:    r.Priority,
                       Created:     r.Created.Time,
               })
       }
       return gs, nil
}

func (s Server) createGrievance(ctx context.Context, g NewGrievance) (Grievance, error) {
	tz, err := time.LoadLocation(g.TimeZone)
	if err != nil {
		return Grievance{}, err
	}

	id := uuid.New()
       rec := grievanceRecord{
               Id:          id.String(),
               Name:        g.Name,
               Description: g.Description,
               Priority:    g.Priority,
               Created:     Now().In(
				tz
			   ),
       }
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
       oid := openapi_types.UUID(id)
       return Grievance{
               Id:          &oid,
               Name:        g.Name,
               Description: g.Description,
               Priority:    g.Priority,
               Created:     rec.Created.Time,
       }, err
}

func (s Server) updateGrievance(ctx context.Context, id string, g NewGrievance) (Grievance, error) {
	existing, err := s.getGrievance(ctx, id)
	if err != nil {
		return Grievance{}, err
	}
	if existing == nil {
		return Grievance{}, errGrievanceNotFound
	}
       rec := grievanceRecord{
               Id:          id,
               Name:        g.Name,
               Description: g.Description,
               Priority:    g.Priority,
               Created:     Time{Time: existing.Created},
       }
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return Grievance{}, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.grievancesTableName),
		Item:      item,
	})
       uid := uuid.MustParse(id)
       oid := openapi_types.UUID(uid)
       return Grievance{
               Id:          &oid,
               Name:        g.Name,
               Description: g.Description,
               Priority:    g.Priority,
               Created:     existing.Created,
       }, err
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
       uid := uuid.MustParse(rec.Id)
       oid := openapi_types.UUID(uid)
       g := Grievance{
               Id:          &oid,
               Name:        rec.Name,
               Description: rec.Description,
               Priority:    rec.Priority,
               Created:     rec.Created.Time,
       }
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
