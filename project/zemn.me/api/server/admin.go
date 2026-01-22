package apiserver

import (
	"context"

	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

// GetAdminUid returns the OIDC subject ID associated with the request.
func (s *Server) GetAdminUid(ctx context.Context, rq api_types.GetAdminUidRequestObject) (api_types.GetAdminUidResponseObject, error) {
	sub, ok := auth.SubjectFromContext(ctx)
	if !ok {
		return nil, nil
	}
	return api_types.GetAdminUid200JSONResponse{
		Uid: sub,
	}, nil
}
