package apiserver

import (
        "context"
        "crypto/ecdsa"
        "crypto/x509"
        "encoding/base64"
        "encoding/pem"
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

        pub, ok := pkix.(*ecdsa.PublicKey)
        if !ok {
                return GetJWKSdefaultResponse{StatusCode: http.StatusInternalServerError}, nil
        }

        size := (pub.Curve.Params().BitSize + 7) / 8
        xb := pub.X.Bytes()
        yb := pub.Y.Bytes()
        xbuf := make([]byte, size)
        ybuf := make([]byte, size)
        copy(xbuf[size-len(xb):], xb)
        copy(ybuf[size-len(yb):], yb)

        x := base64.RawURLEncoding.EncodeToString(xbuf)
        y := base64.RawURLEncoding.EncodeToString(ybuf)

        jwks := JWKS{Keys: []JWK{{
                Kty: "EC",
                Alg: "ES256",
                Use: "sig",
                Crv: "P-256",
                X:   x,
                Y:   y,
        }}}

        return GetJWKS200JSONResponse(jwks), nil
}

