package apiserver

import (
	"context"
	_ "embed"
)

//go:embed security.txt
var securityTxt string

func (s *Server) GetSecurityTxt(ctx context.Context, rq GetSecurityTxtRequestObject) (GetSecurityTxtResponseObject, error) {
	return GetSecurityTxt200TextResponse(securityTxt), nil
}

func (s *Server) GetWellKnownSecurityTxt(ctx context.Context, rq GetWellKnownSecurityTxtRequestObject) (GetWellKnownSecurityTxtResponseObject, error) {
	return GetWellKnownSecurityTxt200TextResponse(securityTxt), nil
}
