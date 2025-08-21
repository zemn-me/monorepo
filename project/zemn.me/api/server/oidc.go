package apiserver

import (
	"context"
)

func (s *Server) IssueIdToken(ctx context.Context, token IdToken) (string, error) {
	return s.IssueJWT(ctx, token)
}
