package apiserver

import (
        "context"
        "crypto/rsa"
        "crypto/x509"
        "encoding/base64"
        "encoding/pem"
        "math/big"
        "net/http"
        "os"
)

// GetJWKS exposes the public key in JWK Set format.
func (s *Server) GetJWKS(_ context.Context, _ GetJWKSRequestObject) (GetJWKSResponseObject, error) {
        pubPem := os.Getenv("OIDC_JWT_PUBLIC_KEY")
        if pubPem == "" {
                return GetJWKSdefaultResponse{StatusCode: http.StatusInternalServerError}, nil
        }

        block, _ := pem.Decode([]byte(pubPem))
        if block == nil {
                return GetJWKSdefaultResponse{StatusCode: http.StatusInternalServerError}, nil
        }

        pkix, err := x509.ParsePKIXPublicKey(block.Bytes)
        if err != nil {
                return GetJWKSdefaultResponse{StatusCode: http.StatusInternalServerError}, nil
        }

        pub, ok := pkix.(*rsa.PublicKey)
        if !ok {
                return GetJWKSdefaultResponse{StatusCode: http.StatusInternalServerError}, nil
        }

        n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
        e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())

        jwks := JWKS{Keys: []JWK{{
                Kty: "RSA",
                Alg: "RS256",
                Use: "sig",
                N:   n,
                E:   e,
        }}}

        return GetJWKS200JSONResponse(jwks), nil
}

