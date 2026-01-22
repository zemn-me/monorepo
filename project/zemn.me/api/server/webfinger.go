package apiserver

import (
	"context"
	"net/http"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

// GetWebFinger deliberately unimplemented.
func (s *Server) GetWebFinger(_ context.Context,
	req api_types.GetWebFingerRequestObject,
) (api_types.GetWebFingerResponseObject, error) {
	return api_types.GetWebFingerdefaultResponse{
		StatusCode: http.StatusNotImplemented,
	}, nil
}
