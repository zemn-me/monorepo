package apiserver

import (
	"context"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

type userRecord struct {
	Id            string   `dynamodbav:"id"`
	Email         string   `dynamodbav:"email,omitempty"`
	Issuer        string   `dynamodbav:"issuer,omitempty"`
	Provider      string   `dynamodbav:"provider,omitempty"`
	Audience      string   `dynamodbav:"audience,omitempty"`
	RemoteSubject string   `dynamodbav:"remote_subject,omitempty"`
	Name          string   `dynamodbav:"name,omitempty"`
	GivenName     string   `dynamodbav:"given_name,omitempty"`
	FamilyName    string   `dynamodbav:"family_name,omitempty"`
	Picture       string   `dynamodbav:"picture,omitempty"`
	EmailVerified *bool    `dynamodbav:"email_verified,omitempty"`
	Scopes        []string `dynamodbav:"scopes,omitempty"`
}

type tokenExchangeUserDetails struct {
	Issuer        string
	Provider      string
	Audience      string
	RemoteSubject string
	Email         string
	Name          string
	GivenName     string
	FamilyName    string
	Picture       string
	EmailVerified *bool
	Scopes        []string
}

func toOptionalString(v string) *string {
	if v == "" {
		return nil
	}
	x := v
	return &x
}

func toOptionalEmail(v string) *openapi_types.Email {
	if v == "" {
		return nil
	}
	x := openapi_types.Email(v)
	return &x
}

func userFromRecord(r userRecord) User {
	var scopes *[]string
	if len(r.Scopes) > 0 {
		copied := append([]string(nil), r.Scopes...)
		scopes = &copied
	}

	return User{
		Id:            r.Id,
		Email:         toOptionalEmail(r.Email),
		Issuer:        toOptionalString(r.Issuer),
		Provider:      toOptionalString(r.Provider),
		Audience:      toOptionalString(r.Audience),
		RemoteSubject: toOptionalString(r.RemoteSubject),
		Name:          toOptionalString(r.Name),
		GivenName:     toOptionalString(r.GivenName),
		FamilyName:    toOptionalString(r.FamilyName),
		Picture:       toOptionalString(r.Picture),
		EmailVerified: r.EmailVerified,
		Scopes:        scopes,
	}
}

func (s Server) listUserRecords(ctx context.Context) ([]userRecord, error) {
	out, err := s.ddb.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(s.usersTableName),
	})
	if err != nil {
		return nil, err
	}
	var recs []userRecord
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &recs); err != nil {
		return nil, err
	}
	return recs, nil
}

func (s Server) putUserRecord(ctx context.Context, rec userRecord) error {
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.usersTableName),
		Item:      item,
	})
	return err
}

func canonicalEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func userRecordFromNewUser(body NewUser) userRecord {
	var scopes []string
	if body.Scopes != nil {
		scopes = append([]string(nil), *body.Scopes...)
	}
	return userRecord{
		Id:     uuid.NewString(),
		Email:  canonicalEmail(string(body.Email)),
		Scopes: scopes,
	}
}

func (s Server) findUserByRemoteSubject(ctx context.Context, issuer, remoteSubject string) (*userRecord, error) {
	if issuer == "" || remoteSubject == "" {
		return nil, nil
	}
	recs, err := s.listUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	for _, rec := range recs {
		if rec.Issuer == issuer && rec.RemoteSubject == remoteSubject {
			r := rec
			return &r, nil
		}
	}
	return nil, nil
}

func (s Server) findUserByEmail(ctx context.Context, email string) (*userRecord, error) {
	e := canonicalEmail(email)
	if e == "" {
		return nil, nil
	}
	recs, err := s.listUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	for _, rec := range recs {
		if canonicalEmail(rec.Email) == e {
			r := rec
			return &r, nil
		}
	}
	return nil, nil
}

func mergeTokenExchangeDetails(rec *userRecord, details tokenExchangeUserDetails) {
	rec.Issuer = details.Issuer
	rec.Provider = details.Provider
	rec.Audience = details.Audience
	rec.RemoteSubject = details.RemoteSubject

	if details.Email != "" {
		rec.Email = canonicalEmail(details.Email)
	}
	if details.Name != "" {
		rec.Name = details.Name
	}
	if details.GivenName != "" {
		rec.GivenName = details.GivenName
	}
	if details.FamilyName != "" {
		rec.FamilyName = details.FamilyName
	}
	if details.Picture != "" {
		rec.Picture = details.Picture
	}
	if details.EmailVerified != nil {
		rec.EmailVerified = details.EmailVerified
	}
	if len(details.Scopes) > 0 {
		rec.Scopes = append([]string(nil), details.Scopes...)
	}
}

func (s Server) maybeResolveUserFromTable(ctx context.Context, details tokenExchangeUserDetails) (*userRecord, error) {
	if s.usersTableName == "" {
		return nil, nil
	}

	rec, err := s.findUserByRemoteSubject(ctx, details.Issuer, details.RemoteSubject)
	if err != nil {
		return nil, err
	}
	if rec == nil {
		rec, err = s.findUserByEmail(ctx, details.Email)
		if err != nil {
			return nil, err
		}
	}
	if rec == nil {
		return nil, nil
	}
	mergeTokenExchangeDetails(rec, details)
	if err := s.putUserRecord(ctx, *rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func (s Server) GetAdminUsers(ctx context.Context, rq GetAdminUsersRequestObject) (GetAdminUsersResponseObject, error) {
	recs, err := s.listUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	users := make([]User, 0, len(recs))
	for _, rec := range recs {
		users = append(users, userFromRecord(rec))
	}
	return GetAdminUsers200JSONResponse(users), nil
}

func (s Server) PostAdminUsers(ctx context.Context, rq PostAdminUsersRequestObject) (PostAdminUsersResponseObject, error) {
	rec := userRecordFromNewUser(*rq.Body)
	if err := s.putUserRecord(ctx, rec); err != nil {
		return nil, err
	}
	return PostAdminUsers200JSONResponse(userFromRecord(rec)), nil
}

func (s Server) PutAdminUsersId(ctx context.Context, rq PutAdminUsersIdRequestObject) (PutAdminUsersIdResponseObject, error) {
	recs, err := s.listUserRecords(ctx)
	if err != nil {
		return nil, err
	}

	var found *userRecord
	for _, rec := range recs {
		if rec.Id == rq.Id {
			copyRec := rec
			found = &copyRec
			break
		}
	}
	if found == nil {
		return PutAdminUsersId404Response{}, nil
	}

	if rq.Body.Email != nil {
		found.Email = canonicalEmail(string(*rq.Body.Email))
	}
	if rq.Body.Scopes != nil {
		found.Scopes = append([]string(nil), *rq.Body.Scopes...)
	}

	if err := s.putUserRecord(ctx, *found); err != nil {
		return nil, err
	}
	return PutAdminUsersId200JSONResponse(userFromRecord(*found)), nil
}

func (s Server) DeleteAdminUsersId(ctx context.Context, rq DeleteAdminUsersIdRequestObject) (DeleteAdminUsersIdResponseObject, error) {
	_, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.usersTableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: rq.Id},
		},
	})
	if err != nil {
		return nil, err
	}
	return DeleteAdminUsersId200JSONResponse("ok"), nil
}
