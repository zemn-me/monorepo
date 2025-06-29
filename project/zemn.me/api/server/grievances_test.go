package apiserver

import (
	"context"
	"github.com/google/uuid"
	"testing"
)

func TestGrievanceCRUD(t *testing.T) {
	s := newTestServer()
	// create
	body := NewGrievance{Name: "foo", Description: "bar", Priority: 5}
	createReq := PostGrievancesRequestObject{Body: &body}
	createResp, err := s.PostGrievances(context.Background(), createReq)
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
       id := uuid.UUID(*created.Id).String()

	// read
	getResp, err := s.GetGrievanceId(context.Background(), GetGrievanceIdRequestObject{Id: id})
	if err != nil {
		t.Fatalf("get grievance: %v", err)
	}
	got := Grievance(getResp.(GetGrievanceId200JSONResponse))
	if got.Name != "foo" || got.Description != "bar" || got.Priority != 5 {
		t.Fatalf("unexpected grievance: %+v", got)
	}

	// update
	updatedBody := NewGrievance{Name: "baz", Description: "qux", Priority: 3}
	updReq := PutGrievanceIdRequestObject{Id: id, Body: &updatedBody}
	updResp, err := s.PutGrievanceId(context.Background(), updReq)
	if err != nil {
		t.Fatalf("update grievance: %v", err)
	}
       upd := Grievance(updResp.(PutGrievanceId200JSONResponse))
       if upd.Name != "baz" || upd.Priority != 3 {
               t.Fatalf("update failed: %+v", upd)
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
	body := NewGrievance{Name: "foo", Description: "bar", Priority: 1}
	resp, err := s.PutGrievanceId(context.Background(), PutGrievanceIdRequestObject{Id: uuid.NewString(), Body: &body})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := resp.(PutGrievanceId404Response); !ok {
		t.Fatalf("expected 404 response")
	}
}
