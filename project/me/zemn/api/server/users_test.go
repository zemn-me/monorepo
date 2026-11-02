package apiserver

import (
	"context"
	"testing"
)

func TestPostAndListAdminUsers(t *testing.T) {
	s := newTestServer()

	createdResp, err := s.PostAdminUsers(context.Background(), PostAdminUsersRequestObject{
		Body: &NewUser{
			Email: "TestUser@example.com",
			Scopes: &[]string{
				"grievance_portal",
			},
		},
	})
	if err != nil {
		t.Fatalf("create admin user: %v", err)
	}

	created, ok := createdResp.(PostAdminUsers200JSONResponse)
	if !ok {
		t.Fatalf("unexpected create response type: %T", createdResp)
	}
	if created.Id == "" {
		t.Fatalf("expected generated id")
	}
	if created.Emails == nil || len(*created.Emails) != 1 || (*created.Emails)[0] != "testuser@example.com" {
		t.Fatalf("unexpected normalized emails: %#v", created.Emails)
	}
	if created.Scopes == nil || len(*created.Scopes) != 1 || (*created.Scopes)[0] != "grievance_portal" {
		t.Fatalf("unexpected scopes: %#v", created.Scopes)
	}

	listResp, err := s.GetAdminUsers(context.Background(), GetAdminUsersRequestObject{})
	if err != nil {
		t.Fatalf("list admin users: %v", err)
	}
	users, ok := listResp.(GetAdminUsers200JSONResponse)
	if !ok {
		t.Fatalf("unexpected list response type: %T", listResp)
	}
	if len(users) != 3 {
		t.Fatalf("expected 3 users, got %d", len(users))
	}
	seen := map[string]bool{}
	for _, user := range users {
		seen[user.Id] = true
	}
	if !seen[created.Id] {
		t.Fatalf("expected listed user id %q", created.Id)
	}
}

func TestGetAdminUsersIncludesHardcoded(t *testing.T) {
	s := newTestServer()

	listResp, err := s.GetAdminUsers(context.Background(), GetAdminUsersRequestObject{})
	if err != nil {
		t.Fatalf("list admin users: %v", err)
	}
	users, ok := listResp.(GetAdminUsers200JSONResponse)
	if !ok {
		t.Fatalf("unexpected list response type: %T", listResp)
	}

	seen := map[string]bool{}
	for _, user := range users {
		seen[user.Id] = true
	}
	if !seen["thomas"] || !seen["keng"] {
		t.Fatalf("expected hardcoded users to be listed, got %v", seen)
	}
}

func TestMaybeResolveUserFromTableMatchesEmailAndBackfillsClaims(t *testing.T) {
	s := newTestServer()

	createResp, err := s.PostAdminUsers(context.Background(), PostAdminUsersRequestObject{
		Body: &NewUser{
			Email:  "person@example.com",
			Scopes: &[]string{"admin_uid_read"},
		},
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	created := createResp.(PostAdminUsers200JSONResponse)

	emailVerified := true
	resolved, err := s.maybeResolveUserFromTable(context.Background(), tokenExchangeUserDetails{
		Issuer:        "https://accounts.google.com",
		Provider:      "https://accounts.google.com",
		Audience:      googleClientID,
		RemoteSubject: "remote-subject-123",
		Email:         "person@example.com",
		Name:          "Person Example",
		GivenName:     "Person",
		FamilyName:    "Example",
		Picture:       "https://example.com/pic.png",
		EmailVerified: &emailVerified,
	})
	if err != nil {
		t.Fatalf("resolve user: %v", err)
	}
	if resolved == nil {
		t.Fatalf("expected user resolution")
	}
	if resolved.Id != created.Id {
		t.Fatalf("expected resolved id %q, got %q", created.Id, resolved.Id)
	}

	rec, err := s.findUserByRemoteSubject(
		context.Background(),
		"https://accounts.google.com",
		"remote-subject-123",
	)
	if err != nil {
		t.Fatalf("lookup updated record: %v", err)
	}
	if rec == nil {
		t.Fatalf("expected remote subject mapping to be backfilled")
	}
	if rec.Name != "Person Example" {
		t.Fatalf("expected name to be backfilled, got %q", rec.Name)
	}
	if rec.EmailVerified == nil || !*rec.EmailVerified {
		t.Fatalf("expected email_verified true, got %#v", rec.EmailVerified)
	}
	if len(rec.Scopes) != 1 || rec.Scopes[0] != "admin_uid_read" {
		t.Fatalf("expected scopes to be preserved, got %#v", rec.Scopes)
	}
}

func TestPutAdminUserUpdatesScopes(t *testing.T) {
	s := newTestServer()

	createResp, err := s.PostAdminUsers(context.Background(), PostAdminUsersRequestObject{
		Body: &NewUser{
			Email: "scope@example.com",
		},
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	created := createResp.(PostAdminUsers200JSONResponse)

	updateResp, err := s.PutAdminUser(context.Background(), PutAdminUserRequestObject{
		Body: &AdminUserUpdateRequest{
			Id:     created.Id,
			Scopes: &[]string{"admin_users_read", "admin_users_manage"},
		},
	})
	if err != nil {
		t.Fatalf("update user scopes: %v", err)
	}
	updated := updateResp.(PutAdminUser200JSONResponse)
	if updated.Scopes == nil || len(*updated.Scopes) != 2 {
		t.Fatalf("expected two scopes, got %#v", updated.Scopes)
	}
}

func TestDeleteAdminUser(t *testing.T) {
	s := newTestServer()

	createResp, err := s.PostAdminUsers(context.Background(), PostAdminUsersRequestObject{
		Body: &NewUser{
			Email: "deleteme@example.com",
		},
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	created := createResp.(PostAdminUsers200JSONResponse)

	_, err = s.DeleteAdminUser(context.Background(), DeleteAdminUserRequestObject{
		Body: &AdminUserDeleteRequest{
			Id: created.Id,
		},
	})
	if err != nil {
		t.Fatalf("delete user: %v", err)
	}

	listResp, err := s.GetAdminUsers(context.Background(), GetAdminUsersRequestObject{})
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	users := listResp.(GetAdminUsers200JSONResponse)
	if len(users) != 2 {
		t.Fatalf("expected only hardcoded users after delete, got %d", len(users))
	}
}
