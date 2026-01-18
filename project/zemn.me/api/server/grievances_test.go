package apiserver

import (
	"context"
	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
	"testing"
)

func TestGrievanceCRUD(t *testing.T) {
	s := newTestServer()
	// create
	tz := "America/Los_Angeles"
	body := api_types.NewGrievance{Name: "foo", Description: "bar", Priority: 5, TimeZone: &tz}
	createReq := api_types.PostGrievancesRequestObject{Body: &body}
	ctx := auth.WithIdToken(context.Background(), api_types.IdToken{
		Iss: "https://accounts.google.com",
		Sub: "test-subject",
		Aud: "zemn.me",
		Exp: 1,
		Iat: 1,
		Email: func() *string {
			email := "poster@example.com"
			return &email
		}(),
	})
	createResp, err := s.PostGrievances(ctx, createReq)
	if err != nil {
		t.Fatalf("create grievance: %v", err)
	}
	created := api_types.Grievance(createResp.(api_types.PostGrievances200JSONResponse))
	if created.Id == nil {
		t.Fatalf("expected id assigned")
	}
	if created.Created.IsZero() {
		t.Fatalf("expected created time set")
	}
	if created.PosterEmail == nil || *created.PosterEmail != "poster@example.com" {
		t.Fatalf("expected poster email set, got %+v", created.PosterEmail)
	}
	id := uuid.UUID(*created.Id).String()

	// read
	getResp, err := s.GetGrievanceId(context.Background(), api_types.GetGrievanceIdRequestObject{Id: id})
	if err != nil {
		t.Fatalf("get grievance: %v", err)
	}
	got := api_types.Grievance(getResp.(api_types.GetGrievanceId200JSONResponse))
	if got.Name != "foo" || got.Description != "bar" || got.Priority != 5 || got.TimeZone == nil || *got.TimeZone != "America/Los_Angeles" {
		t.Fatalf("unexpected grievance: %+v", got)
	}
	if got.PosterEmail == nil || *got.PosterEmail != "poster@example.com" {
		t.Fatalf("expected poster email persisted, got %+v", got.PosterEmail)
	}

	// update
	newTZ := "Asia/Tokyo"
	updatedBody := api_types.NewGrievance{Name: "baz", Description: "qux", Priority: 3, TimeZone: &newTZ}
	updReq := api_types.PutGrievanceIdRequestObject{Id: id, Body: &updatedBody}
	updResp, err := s.PutGrievanceId(context.Background(), updReq)
	if err != nil {
		t.Fatalf("update grievance: %v", err)
	}
	upd := api_types.Grievance(updResp.(api_types.PutGrievanceId200JSONResponse))
	if upd.Name != "baz" || upd.Priority != 3 || upd.TimeZone == nil || *upd.TimeZone != "Asia/Tokyo" {
		t.Fatalf("update failed: %+v", upd)
	}
	if !upd.Created.Equal(created.Created) {
		t.Fatalf("created time changed on update: %v vs %v", upd.Created, created.Created)
	}

	// list
	listResp, err := s.GetGrievances(context.Background(), api_types.GetGrievancesRequestObject{})
	if err != nil {
		t.Fatalf("list grievances: %v", err)
	}
	list := []api_types.Grievance(listResp.(api_types.GetGrievances200JSONResponse))
	if len(list) != 1 {
		t.Fatalf("expected 1 grievance, got %d", len(list))
	}
	if !list[0].Created.Equal(created.Created) {
		t.Fatalf("list mismatch: %v vs %v", list[0].Created, created.Created)
	}

	// delete
	_, err = s.DeleteGrievanceId(context.Background(), api_types.DeleteGrievanceIdRequestObject{Id: id})
	if err != nil {
		t.Fatalf("delete grievance: %v", err)
	}
	listResp, err = s.GetGrievances(context.Background(), api_types.GetGrievancesRequestObject{})
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	list = []api_types.Grievance(listResp.(api_types.GetGrievances200JSONResponse))
	if len(list) != 0 {
		t.Fatalf("expected 0 grievances after delete, got %d", len(list))
	}
}

func TestPutGrievanceNotFound(t *testing.T) {
	s := newTestServer()
	tz2 := "America/Los_Angeles"
	body := api_types.NewGrievance{Name: "foo", Description: "bar", Priority: 1, TimeZone: &tz2}
	resp, err := s.PutGrievanceId(context.Background(), api_types.PutGrievanceIdRequestObject{Id: uuid.NewString(), Body: &body})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := resp.(api_types.PutGrievanceId404Response); !ok {
		t.Fatalf("expected 404 response")
	}
}
