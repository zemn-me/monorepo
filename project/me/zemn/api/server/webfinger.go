package apiserver

import (
	"context"
	"net/http"
)

// GetWebFinger deliberately unimplemented.
func (s *Server) GetWebFinger(_ context.Context,
	req GetWebFingerRequestObject,
) (GetWebFingerResponseObject, error) {
	return GetWebFingerdefaultResponse{
		StatusCode: http.StatusNotImplemented,
	}, nil
}
