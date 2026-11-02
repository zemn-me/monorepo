package apiserver

import "context"

func (s *Server) GetHealthz(ctx context.Context, rq GetHealthzRequestObject) (rs GetHealthzResponseObject, err error) {
	return GetHealthz200JSONResponse("OK"), nil
}
