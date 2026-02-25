package apiserver

import (
	"context"
	"errors"
	"net/url"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

type userRecord struct {
	Id            string   `dynamodbav:"id"`
	When          Time     `dynamodbav:"when"`
	Deleted       bool     `dynamodbav:"deleted,omitempty"`
	Deletable     bool     `dynamodbav:"deletable,omitempty"`
	SubjectIds    []string `dynamodbav:"subject_ids,omitempty"`
	Emails        []string `dynamodbav:"emails,omitempty"`
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

func toOptionalEmails(values []string) *[]openapi_types.Email {
	if len(values) == 0 {
		return nil
	}
	emails := make([]openapi_types.Email, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		emails = append(emails, openapi_types.Email(value))
	}
	if len(emails) == 0 {
		return nil
	}
	return &emails
}

func toOptionalStrings(values []string) *[]string {
	if len(values) == 0 {
		return nil
	}
	copied := append([]string(nil), values...)
	return &copied
}

func userFromRecord(r userRecord) User {
	var scopes *[]string
	if len(r.Scopes) > 0 {
		copied := append([]string(nil), r.Scopes...)
		scopes = &copied
	}

	return User{
		Id:            r.Id,
		Deletable:     r.Deletable,
		SubjectIds:    toOptionalStrings(r.SubjectIds),
		Emails:        toOptionalEmails(r.Emails),
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

func (s Server) latestUserRecords(ctx context.Context) (map[string]userRecord, error) {
	recs, err := s.listUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	latest := make(map[string]userRecord, len(recs))
	for _, rec := range recs {
		existing, ok := latest[rec.Id]
		if !ok || rec.When.After(existing.When.Time) {
			latest[rec.Id] = rec
		}
	}
	return latest, nil
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

func canonicalSubjectID(issuer, subject string) string {
	if issuer == "" || subject == "" {
		return ""
	}
	parsed, err := url.Parse(issuer)
	if err != nil || parsed.Host == "" {
		return ""
	}
	parsed.User = url.User(subject)
	return parsed.String()
}

func canonicalSubjectIDFromValue(value string) string {
	if value == "" {
		return ""
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" || parsed.User == nil {
		return ""
	}
	subject := parsed.User.Username()
	if subject == "" {
		return ""
	}
	issuer := url.URL{
		Scheme: parsed.Scheme,
		Host:   parsed.Host,
		Path:   parsed.Path,
	}
	return canonicalSubjectID(issuer.String(), subject)
}

func addSubjectID(subjectIDs []string, issuer, subject string) []string {
	id := canonicalSubjectID(issuer, subject)
	if id == "" {
		return subjectIDs
	}
	for _, existing := range subjectIDs {
		if existing == id {
			return subjectIDs
		}
	}
	return append(subjectIDs, id)
}

func normalizeSubjectIDs(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	var subjectIDs []string
	for _, value := range values {
		id := canonicalSubjectIDFromValue(value)
		if id == "" {
			continue
		}
		if len(subjectIDs) == 0 {
			subjectIDs = []string{id}
			continue
		}
		already := false
		for _, existing := range subjectIDs {
			if existing == id {
				already = true
				break
			}
		}
		if !already {
			subjectIDs = append(subjectIDs, id)
		}
	}
	return subjectIDs
}

func addEmail(emails []string, email string) []string {
	if email == "" {
		return emails
	}
	for _, existing := range emails {
		if existing == email {
			return emails
		}
	}
	return append(emails, email)
}

func ensureScope(scopes []string, scope string) []string {
	for _, existing := range scopes {
		if existing == scope {
			return scopes
		}
	}
	return append(scopes, scope)
}

func userRecordFromNewUser(body NewUser) userRecord {
	var scopes []string
	if body.Scopes != nil {
		scopes = append([]string(nil), *body.Scopes...)
	}
	email := canonicalEmail(string(body.Email))
	return userRecord{
		Id:        uuid.NewString(),
		When:      Now(),
		Deletable: true,
		Emails:    addEmail(nil, email),
		Scopes:    scopes,
	}
}

func userRecordFromTokenExchange(localID OIDCSubject, details tokenExchangeUserDetails, scopes []string) userRecord {
	rec := userRecord{
		Id:            string(localID),
		When:          Now(),
		Deleted:       false,
		Deletable:     !isHardcodedSubject(string(localID)),
		SubjectIds:    addSubjectID(nil, details.Issuer, details.RemoteSubject),
		Issuer:        details.Issuer,
		Provider:      details.Provider,
		Audience:      details.Audience,
		RemoteSubject: details.RemoteSubject,
		Name:          details.Name,
		GivenName:     details.GivenName,
		FamilyName:    details.FamilyName,
		Picture:       details.Picture,
		EmailVerified: details.EmailVerified,
	}
	if details.Email != "" {
		rec.Emails = addEmail(rec.Emails, canonicalEmail(details.Email))
	}
	if len(scopes) > 0 {
		rec.Scopes = append([]string(nil), scopes...)
	}
	return rec
}

func (s Server) findUserByRemoteSubject(ctx context.Context, issuer, remoteSubject string) (*userRecord, error) {
	if issuer == "" || remoteSubject == "" {
		return nil, nil
	}
	subjectID := canonicalSubjectID(issuer, remoteSubject)
	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	for _, rec := range recs {
		if rec.Deleted {
			continue
		}
		for _, candidate := range rec.SubjectIds {
			if candidate == subjectID {
				r := rec
				return &r, nil
			}
		}
	}
	return nil, nil
}

func (s Server) findUserByLocalID(ctx context.Context, localID string) (*userRecord, error) {
	if localID == "" {
		return nil, nil
	}
	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	rec, ok := recs[localID]
	if !ok {
		return nil, nil
	}
	if rec.Deleted {
		return nil, nil
	}
	return &rec, nil
}

func (s Server) findUserByEmail(ctx context.Context, email string) (*userRecord, error) {
	e := canonicalEmail(email)
	if e == "" {
		return nil, nil
	}
	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	for _, rec := range recs {
		if rec.Deleted {
			continue
		}
		for _, addr := range rec.Emails {
			if canonicalEmail(addr) == e {
				r := rec
				return &r, nil
			}
		}
	}
	return nil, nil
}

func mergeTokenExchangeDetails(rec *userRecord, details tokenExchangeUserDetails) {
	rec.When = Now()
	rec.Deleted = false
	if isHardcodedSubject(rec.Id) {
		rec.Deletable = false
	} else if rec.Deletable == false {
		rec.Deletable = true
	}
	rec.SubjectIds = addSubjectID(rec.SubjectIds, details.Issuer, details.RemoteSubject)
	rec.Issuer = details.Issuer
	rec.Provider = details.Provider
	rec.Audience = details.Audience
	rec.RemoteSubject = details.RemoteSubject

	if details.Email != "" {
		rec.Emails = addEmail(rec.Emails, canonicalEmail(details.Email))
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
	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}
	users := make([]User, 0, len(recs))
	seenIds := make(map[string]struct{}, len(recs))
	deletedIds := make(map[string]struct{}, len(recs))
	for _, rec := range recs {
		if rec.Deleted {
			deletedIds[rec.Id] = struct{}{}
			continue
		}
		user := userFromRecord(rec)
		seenIds[user.Id] = struct{}{}
		users = append(users, user)
	}

	for _, subject := range hardcodedSubjectsFromUpstream() {
		if _, ok := seenIds[subject]; ok {
			continue
		}
		if _, ok := deletedIds[subject]; ok {
			continue
		}
		scopes := hardcodedScopesForSubject(OIDCSubject(subject))
		var scopeList *[]string
		if len(scopes) > 0 {
			copied := append([]string(nil), scopes...)
			scopeList = &copied
		}
		subjectIds := hardcodedSubjectIDsFromUpstream(subject)
		users = append(users, User{
			Id:         subject,
			Deletable:  false,
			SubjectIds: toOptionalStrings(subjectIds),
			Scopes:     scopeList,
		})
	}
	return GetAdminUsers200JSONResponse(users), nil
}

func (s Server) GetMeScopes(ctx context.Context, rq GetMeScopesRequestObject) (GetMeScopesResponseObject, error) {
	subject, ok := auth.SubjectFromContext(ctx)
	if !ok {
		return nil, errors.New("missing subject in context")
	}
	issuer, ok := auth.IssuerFromContext(ctx)
	if !ok {
		return nil, errors.New("missing issuer in context")
	}

	scopes, err := s.resolveScopes(ctx, issuer, subject)
	if err != nil {
		return nil, err
	}
	if scopes == nil {
		scopes = []string{}
	}

	return GetMeScopes200JSONResponse{
		Scopes: scopes,
	}, nil
}

func isHardcodedSubject(id string) bool {
	for _, subject := range hardcodedSubjectsFromUpstream() {
		if subject == id {
			return true
		}
	}
	return false
}

func hardcodedSubjectsFromUpstream() []string {
	seen := map[string]struct{}{}
	for _, cfg := range upstreamOIDCIssuers {
		for _, subjectMappings := range cfg.Audience {
			for _, localSubject := range subjectMappings {
				seen[string(localSubject)] = struct{}{}
			}
		}
	}

	subjects := make([]string, 0, len(seen))
	for subject := range seen {
		subjects = append(subjects, subject)
	}
	sort.Strings(subjects)
	return subjects
}

func resolveLocalSubjectFromUpstream(issuer OIDCIssuer, remoteSubject string) (OIDCSubject, bool) {
	cfg, ok := upstreamOIDCIssuers[issuer]
	if !ok {
		return "", false
	}
	for _, subjectMappings := range cfg.Audience {
		if local, ok := subjectMappings[OIDCSubject(remoteSubject)]; ok {
			return local, true
		}
	}
	for _, subjectMappings := range cfg.Audience {
		for _, local := range subjectMappings {
			if local == OIDCSubject(remoteSubject) {
				return local, true
			}
		}
	}
	return "", false
}

func hardcodedSubjectIDsFromUpstream(subject string) []string {
	var subjectIDs []string
	for issuer, cfg := range upstreamOIDCIssuers {
		for _, subjectMappings := range cfg.Audience {
			for remoteSubject, localSubject := range subjectMappings {
				if string(localSubject) != subject {
					continue
				}
				subjectIDs = addSubjectID(subjectIDs, string(issuer), string(remoteSubject))
			}
		}
	}
	return subjectIDs
}

func (s Server) resolveScopes(ctx context.Context, issuer, remoteSubject string) ([]string, error) {
	if s.usersTableName != "" {
		rec, err := s.findUserByLocalID(ctx, remoteSubject)
		if err != nil {
			return nil, err
		}
		if rec != nil {
			return append([]string(nil), rec.Scopes...), nil
		}
	}

	if isHardcodedSubject(remoteSubject) {
		return hardcodedScopesForSubject(OIDCSubject(remoteSubject)), nil
	}

	if s.usersTableName != "" {
		rec, err := s.findUserByRemoteSubject(ctx, issuer, remoteSubject)
		if err != nil {
			return nil, err
		}
		if rec != nil && !rec.Deleted {
			return append([]string(nil), rec.Scopes...), nil
		}
	}

	if local, ok := resolveLocalSubjectFromUpstream(OIDCIssuer(issuer), remoteSubject); ok {
		return hardcodedScopesForSubject(local), nil
	}

	return nil, nil
}

func (s Server) PostAdminUsers(ctx context.Context, rq PostAdminUsersRequestObject) (PostAdminUsersResponseObject, error) {
	rec := userRecordFromNewUser(*rq.Body)
	if err := s.putUserRecord(ctx, rec); err != nil {
		return nil, err
	}
	return PostAdminUsers200JSONResponse(userFromRecord(rec)), nil
}

func (s Server) PutAdminUser(ctx context.Context, rq PutAdminUserRequestObject) (PutAdminUserResponseObject, error) {
	if rq.Body == nil {
		return nil, errors.New("missing request body")
	}

	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}

	rec, ok := recs[rq.Body.Id]
	if !ok || rec.Deleted {
		return PutAdminUser404Response{}, nil
	}

	if rq.Body.Emails != nil {
		var normalized []string
		for _, value := range *rq.Body.Emails {
			normalized = addEmail(normalized, canonicalEmail(string(value)))
		}
		rec.Emails = normalized
	}
	if rq.Body.GivenName != nil {
		rec.GivenName = *rq.Body.GivenName
	}
	if rq.Body.FamilyName != nil {
		rec.FamilyName = *rq.Body.FamilyName
	}
	if rq.Body.Scopes != nil {
		rec.Scopes = append([]string(nil), *rq.Body.Scopes...)
	}
	if rq.Body.SubjectIds != nil {
		rec.SubjectIds = normalizeSubjectIDs(*rq.Body.SubjectIds)
	}
	if isHardcodedSubject(rec.Id) {
		rec.Scopes = ensureScope(rec.Scopes, "admin_users_manage")
	}
	rec.When = Now()
	rec.Deleted = false

	if err := s.putUserRecord(ctx, rec); err != nil {
		return nil, err
	}
	return PutAdminUser200JSONResponse(userFromRecord(rec)), nil
}

func (s Server) DeleteAdminUser(ctx context.Context, rq DeleteAdminUserRequestObject) (DeleteAdminUserResponseObject, error) {
	if rq.Body == nil {
		return nil, errors.New("missing request body")
	}

	recs, err := s.latestUserRecords(ctx)
	if err != nil {
		return nil, err
	}

	tombstone := recs[rq.Body.Id]
	tombstone.Id = rq.Body.Id
	tombstone.When = Now()
	tombstone.Deleted = true

	if err := s.putUserRecord(ctx, tombstone); err != nil {
		return nil, err
	}
	return DeleteAdminUser200JSONResponse("ok"), nil
}
