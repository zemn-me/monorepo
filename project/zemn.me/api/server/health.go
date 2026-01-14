package apiserver

import (
	"context"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

func (s *Server) GetHealthz(ctx context.Context, rq api_types.GetHealthzRequestObject) (rs api_types.GetHealthzResponseObject, err error) {
	return api_types.GetHealthz200JSONResponse("OK"), nil
}
