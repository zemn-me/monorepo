package apiserver

import (
        "crypto/ecdsa"
        "crypto/elliptic"
        "crypto/rand"
        "crypto/x509"
        "encoding/base64"
        "encoding/json"
        "encoding/pem"
        "net/http"
        "net/http/httptest"
        "testing"
)

func TestJWKS(t *testing.T) {
        key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
        if err != nil {
                t.Fatalf("failed to generate key: %v", err)
        }
        der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
        if err != nil {
                t.Fatalf("marshal public key: %v", err)
        }
        pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})
        t.Setenv("OIDC_JWT_PUBLIC_KEY", string(pemBytes))

        s, err := NewServer(t.Context(), NewServerOptions{})
        if err != nil {
                t.Fatalf("failed to create server: %v", err)
        }

        rq := httptest.NewRequest(http.MethodGet, "/.well-known/jwks.json", nil)
        rc := httptest.NewRecorder()
        s.ServeHTTP(rc, rq)

        if rc.Code != http.StatusOK {
                t.Fatalf("unexpected status: %d", rc.Code)
        }

        var jwks struct {
                Keys []struct {
                        X string `json:"x"`
                        Y string `json:"y"`
                } `json:"keys"`
        }
        if err := json.Unmarshal(rc.Body.Bytes(), &jwks); err != nil {
                t.Fatalf("invalid json: %v", err)
        }
        if len(jwks.Keys) != 1 {
                t.Fatalf("expected 1 key, got %d", len(jwks.Keys))
        }
        size := (key.Curve.Params().BitSize + 7) / 8
        xb := key.PublicKey.X.Bytes()
        yb := key.PublicKey.Y.Bytes()
        xbuf := make([]byte, size)
        ybuf := make([]byte, size)
        copy(xbuf[size-len(xb):], xb)
        copy(ybuf[size-len(yb):], yb)
        x := base64.RawURLEncoding.EncodeToString(xbuf)
        y := base64.RawURLEncoding.EncodeToString(ybuf)
        if jwks.Keys[0].X != x {
                t.Errorf("x mismatch")
        }
        if jwks.Keys[0].Y != y {
                t.Errorf("y mismatch")
        }
}

