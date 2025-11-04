package apiserver

import (
	"reflect"
	"testing"

	jose "github.com/go-jose/go-jose/v4"
)

type fakeOpaqueSigner struct {
	public jose.JSONWebKey
}

func (f *fakeOpaqueSigner) Public() *jose.JSONWebKey { return &f.public }
func (f *fakeOpaqueSigner) Algs() []jose.SignatureAlgorithm {
	return []jose.SignatureAlgorithm{jose.ES256}
}
func (f *fakeOpaqueSigner) SignPayload([]byte, jose.SignatureAlgorithm) ([]byte, error) {
	return make([]byte, 64), nil
}

func TestKeySetUsesPublicKeyWhenSigningKeyIsOpaque(t *testing.T) {
	public := jose.JSONWebKey{
		Key:       []byte("public"),
		KeyID:     "kms-key",
		Algorithm: string(jose.ES256),
		Use:       "sig",
	}

	signer := &fakeOpaqueSigner{public: public}

	s := &Server{
		signingKey: jose.JSONWebKey{
			Key:       signer,
			KeyID:     "kms-key",
			Algorithm: string(jose.ES256),
			Use:       "sig",
		},
	}

	ks := s.keySet()
	if len(ks.Keys) != 1 {
		b := len(ks.Keys)
		t.Fatalf("expected 1 JWKS key, got %d", b)
	}

	if !reflect.DeepEqual(ks.Keys[0].Key, public.Key) {
		t.Fatalf("expected JWKS key %q, got %q", public.Key, ks.Keys[0].Key)
	}

	if ks.Keys[0].KeyID != public.KeyID {
		t.Fatalf("expected kid %q, got %q", public.KeyID, ks.Keys[0].KeyID)
	}
}
