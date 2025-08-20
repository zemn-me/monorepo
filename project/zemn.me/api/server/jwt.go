package apiserver

//
// issuance of oidc id_tokens.
//

import (
	"context"

	jose "github.com/go-jose/go-jose/v4"
)

// Example: create and sign a JWT using the KMS key.
func (s *Server) IssueJWT(ctx context.Context, keyid string, claims any) (string, error) {
	key := s.KeysSet().Key(signingKeyId)

	opts := jose.SignerOptions{}
	opts.WithHeader("kid", key.KeyID)
	jwsSigner, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &opts)
	if err != nil {
		return "", err
	}

	obj, err := jwsSigner.Sign(claims)
	if err != nil {
		return "", err
	}
	return obj.CompactSerialize()
}
