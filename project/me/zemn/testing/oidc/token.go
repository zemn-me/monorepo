package oidc

import (
	"encoding/json"
	"time"

	"github.com/go-jose/go-jose/v4"
)

// MintIDToken creates a signed ID token using the test issuer configuration.
func MintIDToken(subject, audience, issuer, nonce string, extraClaims map[string]any) (string, error) {
	key := SigningKey()

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, nil)
	if err != nil {
		return "", err
	}

	claims := map[string]any{
		"iss": issuer,
		"sub": subject,
		"aud": audience,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(5 * time.Minute).Unix(),
		"azp": audience,
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}
	for k, v := range extraClaims {
		claims[k] = v
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	obj, err := signer.Sign(payload)
	if err != nil {
		return "", err
	}

	return obj.CompactSerialize()
}
