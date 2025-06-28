package apiserver

import (
        "context"

        "github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

// GetAdminUid returns the OIDC subject ID associated with the request.
func (s *Server) GetAdminUid(ctx context.Context, rq GetAdminUidRequestObject) (GetAdminUidResponseObject, error) {
        sub, ok := auth.SubjectFromContext(ctx)
        if !ok {
                return nil, nil
        }
        return GetAdminUid200TextResponse(sub), nil
}

