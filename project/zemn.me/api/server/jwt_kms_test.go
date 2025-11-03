package apiserver

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/kms"
	jose "github.com/go-jose/go-jose/v4"
)

type stubKMSClient struct {
	sign func(*kms.SignInput) ([]byte, error)
}

func (s *stubKMSClient) Sign(_ context.Context, input *kms.SignInput, _ ...func(*kms.Options)) (*kms.SignOutput, error) {
	if s.sign == nil {
		return nil, errors.New("sign function not set")
	}
	sig, err := s.sign(input)
	if err != nil {
		return nil, err
	}
	return &kms.SignOutput{Signature: sig}, nil
}

type stubOpaqueSigner struct {
	keyID string
	pub   *ecdsa.PublicKey
	kms   kmsSignAPI
}

func (s *stubOpaqueSigner) Public() *jose.JSONWebKey {
	return &jose.JSONWebKey{
		Key:       s.pub,
		KeyID:     s.keyID,
		Algorithm: string(jose.ES256),
		Use:       "sig",
	}
}

func (s *stubOpaqueSigner) Algs() []jose.SignatureAlgorithm {
	return []jose.SignatureAlgorithm{jose.ES256}
}

func (s *stubOpaqueSigner) SignPayload(payload []byte, alg jose.SignatureAlgorithm) ([]byte, error) {
	if alg != jose.ES256 {
		return nil, jose.ErrUnsupportedAlgorithm
	}
	out, err := s.kms.Sign(context.Background(), &kms.SignInput{Message: payload})
	if err != nil {
		return nil, err
	}
	return out.Signature, nil
}

func TestIssueJWTWithKMSSigner(t *testing.T) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})

	t.Setenv("OIDC_JWT_KMS_KEY_ID", "stub-key")
	t.Setenv("OIDC_JWT_PUBLIC_KEY", string(pemBytes))

	originalFactory := kmsOpaqueSignerFactory
	defer func() { kmsOpaqueSignerFactory = originalFactory }()

	kmsOpaqueSignerFactory = func(ctx context.Context, keyID, publicPEM string) (jose.OpaqueSigner, error) {
		if keyID != "stub-key" {
			t.Fatalf("unexpected key id: %s", keyID)
		}
		if strings.TrimSpace(publicPEM) != strings.TrimSpace(string(pemBytes)) {
			t.Fatalf("unexpected public key\nexpected %s\nactual %s", pemBytes, publicPEM)
		}
		fakeClient := &stubKMSClient{
			sign: func(input *kms.SignInput) ([]byte, error) {
				digest := sha256.Sum256(input.Message)
				sig := make([]byte, 64)
				copy(sig[:32], digest[:])
				copy(sig[32:], digest[:])
				return sig, nil
			},
		}
		return &stubOpaqueSigner{keyID: keyID, pub: &priv.PublicKey, kms: fakeClient}, nil
	}

	ctx := context.Background()
	srv := &Server{}
	srv.signingKey, srv.signer, err = provisionSigningKey(ctx)
	if err != nil {
		t.Fatalf("failed to provision signing key: %v", err)
	}

	token, err := srv.IssueJWT(ctx, map[string]any{"sub": "123"})
	if err != nil {
		t.Fatalf("IssueJWT returned error: %v", err)
	}
	if token == "" {
		t.Fatalf("expected token, got empty string")
	}
	if parts := strings.Split(token, "."); len(parts) != 3 {
		t.Fatalf("expected JWT with 3 parts, got %d", len(parts))
	}

	if srv.signingKey.KeyID != "stub-key" {
		t.Fatalf("expected signing key kid stub-key, got %s", srv.signingKey.KeyID)
	}
}
