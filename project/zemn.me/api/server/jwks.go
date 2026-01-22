package apiserver

import (
	"context"
	"encoding/json"

	"github.com/go-jose/go-jose/v4"
	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

type KeySet struct {
	jose.JSONWebKeySet
}

// Returns the local JWKS type as defined in our openapi spec.
func (k KeySet) Local() (ks api_types.JWKS, err error) {
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
	pub := s.signingKey.Public()
	if signer, ok := s.signingKey.Key.(jose.OpaqueSigner); ok {
		if public := signer.Public(); public != nil {
			pub = *public
		}
	}
	if pub.Key == nil {
		pub = s.signingKey
	}
	if nested, ok := pub.Key.(*jose.JSONWebKey); ok {
		if nested.KeyID == "" {
			nested.KeyID = s.signingKey.KeyID
		}
		if nested.Algorithm == "" {
			nested.Algorithm = s.signingKey.Algorithm
		}
		if nested.Use == "" {
			nested.Use = s.signingKey.Use
		}
		pub = *nested
	}
	if pub.KeyID == "" {
		pub.KeyID = s.signingKey.KeyID
	}
	if pub.Algorithm == "" {
		pub.Algorithm = s.signingKey.Algorithm
	}
	if pub.Use == "" {
		pub.Use = s.signingKey.Use
	}

	return KeySet{jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{pub},
	}}
}

// GetJWKS exposes the public key in JWK Set format.
func (s *Server) GetJWKS(_ context.Context, _ api_types.GetJWKSRequestObject) (r api_types.GetJWKSResponseObject, err error) {
	ks, err := s.keySet().Local()
	if err != nil {
		return nil, err
	}
	return api_types.GetJWKS200JSONResponse(ks), nil
}
