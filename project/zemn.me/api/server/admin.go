package apiserver

import (
	"context"

	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

// GetAdminUid returns the OIDC subject ID associated with the request.
func (s *Server) GetAdminUid(ctx context.Context, rq GetAdminUidRequestObject) (GetAdminUidResponseObject, error) {
	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return nil, nil
	}
	return GetAdminUid200JSONResponse{
		Uid: info.Subject,
	}, nil
}
