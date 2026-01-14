package apiserver

import (
	"context"
	_ "embed"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

//go:embed security.txt
var securityTxt string

func (s *Server) GetSecurityTxt(ctx context.Context, rq api_types.GetSecurityTxtRequestObject) (api_types.GetSecurityTxtResponseObject, error) {
	return api_types.GetSecurityTxt200TextResponse(securityTxt), nil
}

func (s *Server) GetWellKnownSecurityTxt(ctx context.Context, rq api_types.GetWellKnownSecurityTxtRequestObject) (api_types.GetWellKnownSecurityTxtResponseObject, error) {
	return api_types.GetWellKnownSecurityTxt200TextResponse(securityTxt), nil
}
