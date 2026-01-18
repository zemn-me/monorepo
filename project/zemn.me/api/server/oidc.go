package apiserver

import (
	"context"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

func (s *Server) IssueIdToken(ctx context.Context, token api_types.IdToken) (string, error) {
	return s.IssueJWT(ctx, token)
}
