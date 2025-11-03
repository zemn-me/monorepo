package apiserver

//
// issuance of oidc id_tokens.
//

import (
	"context"
	"encoding/json"
	"errors"

	jose "github.com/go-jose/go-jose/v4"
)

// Example: create and sign a JWT using the KMS key.
func (s *Server) IssueJWT(ctx context.Context, claims any) (string, error) {
	if s.signer == nil {
		return "", errors.New("jwt signer not configured")
	}
	opts := jose.SignerOptions{}
	jwsSigner, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: s.signer}, &opts)
	if err != nil {
		return "", err
	}

	claimsBt, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	obj, err := jwsSigner.Sign(claimsBt)
	if err != nil {
		return "", err
	}
	return obj.CompactSerialize()
}
