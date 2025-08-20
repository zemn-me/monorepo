package apiserver

import (
	"context"
	"encoding/json"

	"github.com/go-jose/go-jose/v4"
)

type KeySet struct {
	jose.JSONWebKeySet
}

// Returns the local JWKS type as defined in our openapi spec.
func (k KeySet) Local() (ks JWKS, err error) {
	// this is stupid im sorry
	enc, err := json.Marshal(k.JSONWebKeySet)
	if err != nil {
		return
	}
	err = json.Unmarshal(enc, &ks)
	if err != nil {
		return
	}

	return
}

func (s *Server) keySet() (ks KeySet) {
	return KeySet{jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{s.signingKey},
	}}
}

// GetJWKS exposes the public key in JWK Set format.
func (s *Server) GetJWKS(_ context.Context, _ GetJWKSRequestObject) (r GetJWKSResponseObject, err error) {
	ks, err := s.keySet().Local()
	if err != nil {
		return nil, err
	}
	return GetJWKS200JSONResponse(ks), nil
}
