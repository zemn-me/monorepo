package apiserver

import (
        "context"
        "testing"

        "github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

func TestGetAdminUid(t *testing.T) {
        s := newTestServer()
        ctx := context.WithValue(context.Background(), auth.SubjectKey, "12345")
        resp, err := s.GetAdminUid(ctx, GetAdminUidRequestObject{})
        if err != nil {
                t.Fatalf("unexpected error: %v", err)
        }
        if string(resp.(GetAdminUid200TextResponse)) != "12345" {
                t.Fatalf("unexpected response: %v", resp)
        }
}

