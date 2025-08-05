package apiserver

import (
        "crypto/rand"
        "crypto/rsa"
        "crypto/x509"
        "encoding/base64"
        "encoding/json"
        "encoding/pem"
        "math/big"
        "net/http"
        "net/http/httptest"
        "testing"
)

func TestJWKS(t *testing.T) {
        key, err := rsa.GenerateKey(rand.Reader, 2048)
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
                        N string `json:"n"`
                        E string `json:"e"`
                } `json:"keys"`
        }
        if err := json.Unmarshal(rc.Body.Bytes(), &jwks); err != nil {
                t.Fatalf("invalid json: %v", err)
        }
        if len(jwks.Keys) != 1 {
                t.Fatalf("expected 1 key, got %d", len(jwks.Keys))
        }
        n := base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes())
        e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.PublicKey.E)).Bytes())
        if jwks.Keys[0].N != n {
                t.Errorf("n mismatch")
        }
        if jwks.Keys[0].E != e {
                t.Errorf("e mismatch")
        }
}

