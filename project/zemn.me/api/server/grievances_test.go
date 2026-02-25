package apiserver

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

func TestGrievanceCRUD(t *testing.T) {
	s := newTestServer()
	email := "tester@example.com"
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Subject:    "tester-subject",
		Email:      email,
		GivenName:  "Testy",
		FamilyName: "McTestface",
	})
	// create
	tz := "America/Los_Angeles"
	body := NewGrievance{Description: "bar", Priority: 5, TimeZone: &tz}
	createReq := PostGrievancesRequestObject{Body: &body}
	createResp, err := s.PostGrievances(ctx, createReq)
	if err != nil {
		t.Fatalf("create grievance: %v", err)
	}
	created := Grievance(createResp.(PostGrievances200JSONResponse))
	if created.Id == nil {
		t.Fatalf("expected id assigned")
	}
	if created.Created.IsZero() {
		t.Fatalf("expected created time set")
	}
	if created.Poster == nil || created.Poster.EmailAddress == nil || string(*created.Poster.EmailAddress) != email {
		t.Fatalf("expected poster email %q, got %v", email, created.Poster)
	}
	id := uuid.UUID(*created.Id).String()

	// read
	getResp, err := s.GetGrievanceId(context.Background(), GetGrievanceIdRequestObject{Id: id})
	if err != nil {
		t.Fatalf("get grievance: %v", err)
	}
	got := Grievance(getResp.(GetGrievanceId200JSONResponse))
	if got.Description != "bar" || got.Priority != 5 || got.TimeZone == nil || *got.TimeZone != "America/Los_Angeles" || got.Poster == nil || got.Poster.EmailAddress == nil || string(*got.Poster.EmailAddress) != email {
		t.Fatalf("unexpected grievance: %+v", got)
	}

	// update
	newTZ := "Asia/Tokyo"
	updatedBody := NewGrievance{Description: "qux", Priority: 3, TimeZone: &newTZ}
	updReq := PutGrievanceIdRequestObject{Id: id, Body: &updatedBody}
	updResp, err := s.PutGrievanceId(ctx, updReq)
	if err != nil {
		t.Fatalf("update grievance: %v", err)
	}
	upd := Grievance(updResp.(PutGrievanceId200JSONResponse))
	if upd.Priority != 3 || upd.TimeZone == nil || *upd.TimeZone != "Asia/Tokyo" {
		t.Fatalf("update failed: %+v", upd)
	}
	if upd.Poster == nil || upd.Poster.EmailAddress == nil || string(*upd.Poster.EmailAddress) != email {
		t.Fatalf("poster email changed on update: %v", upd.Poster)
	}
	if !upd.Created.Equal(created.Created) {
		t.Fatalf("created time changed on update: %v vs %v", upd.Created, created.Created)
	}

	// list
	listResp, err := s.GetGrievances(context.Background(), GetGrievancesRequestObject{})
	if err != nil {
		t.Fatalf("list grievances: %v", err)
	}
	list := []Grievance(listResp.(GetGrievances200JSONResponse))
	if len(list) != 1 {
		t.Fatalf("expected 1 grievance, got %d", len(list))
	}
	if !list[0].Created.Equal(created.Created) {
		t.Fatalf("list mismatch: %v vs %v", list[0].Created, created.Created)
	}

	// delete
	_, err = s.DeleteGrievanceId(context.Background(), DeleteGrievanceIdRequestObject{Id: id})
	if err != nil {
		t.Fatalf("delete grievance: %v", err)
	}
	listResp, err = s.GetGrievances(context.Background(), GetGrievancesRequestObject{})
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	list = []Grievance(listResp.(GetGrievances200JSONResponse))
	if len(list) != 0 {
		t.Fatalf("expected 0 grievances after delete, got %d", len(list))
	}
}

func TestPutGrievanceNotFound(t *testing.T) {
	s := newTestServer()
	tz2 := "America/Los_Angeles"
	body := NewGrievance{Description: "bar", Priority: 1, TimeZone: &tz2}
	resp, err := s.PutGrievanceId(context.Background(), PutGrievanceIdRequestObject{Id: uuid.NewString(), Body: &body})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := resp.(PutGrievanceId404Response); !ok {
		t.Fatalf("expected 404 response")
	}
}
