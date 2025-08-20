package apiserver

import (
	"context"

	"gopkg.in/go-jose/go-jose.v2"
)

type KeySet struct {
	jose.JSONWebKeySet
}

// Returns the local JWKS type as defined in our openapi spec.
func (k KeySet) Local() JWKS {
	var keys []JWK
	for _, key := range k.Keys {
		keys = append(keys, JWK{
			Kty: key.KeyType,
			Alg: key.Algorithm,
			Use: key.Use,
			Crv: key.Crv,
			X:   key.X,
			Y:   key.Y,
			Kid: key.KeyID,
		})
	}
	return JWKS{Keys: keys}
}

const signingKeyId = "48d2f400-75b6-4d71-a6d6-8759ea2aa302"

func (s *Server) KeySet() KeySet {
	return KeySet{
		JSONWebKeySet: jose.JSONWebKeySet{
			Keys: []jose.JSONWebKey{
				{
					Key:       s.jwtSigner.pub(),
					Use:       "sig",
					Algorithm: string(jose.ES256),
					KeyID:     signingKeyId,
				},
			},
		},
	}
}

// GetJWKS exposes the public key in JWK Set format.
func (s *Server) GetJWKS(_ context.Context, _ GetJWKSRequestObject) (GetJWKSResponseObject, error) {
	return GetJWKS200JSONResponse(s.KeySet().Local()), nil
}
