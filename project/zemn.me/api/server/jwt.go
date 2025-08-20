package apiserver

//
// issuance of oidc id_tokens.
//

import (
	"context"
	"encoding/json"

	jose "github.com/go-jose/go-jose/v4"
)

// Example: create and sign a JWT using the KMS key.
func (s *Server) IssueJWT(ctx context.Context, claims any) (string, error) {
	opts := jose.SignerOptions{}
	jwsSigner, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: s.signingKey}, &opts)
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
