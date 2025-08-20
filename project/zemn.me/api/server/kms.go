package apiserver

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"io"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
	"gopkg.in/go-jose/go-jose.v2"
)

// Implements ECDSA signatures using AWS KMS for the JOSE ecosystem.
type kmsECDSASigner struct {
	kms   *kms.Client
	keyID string
	pub   *ecdsa.PublicKey
}

var (
	_ jose.SignatureAlgorithm = &kmsECDSASigner{}
	_ crypto.Signer           = &kmsECDSASigner{}
)

func (s *kmsECDSASigner) Public() crypto.PublicKey { return s.pub }

// Sign receives a SHA-256 digest from callers such as go-jose for ES256.
// We pass that digest to KMS with MessageType = DIGEST and return the DER ECDSA sig.
func (s *kmsECDSASigner) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	if opts == nil || opts.HashFunc() != crypto.SHA256 || len(digest) != 32 {
		return nil, errors.New("kms signer: expected SHA-256 digest")
	}
	out, err := s.kms.Sign(context.Background(), &kms.SignInput{
		KeyId:            &s.keyID,
		Message:          digest,
		MessageType:      types.MessageTypeDigest,
		SigningAlgorithm: types.SigningAlgorithmSpecEcdsaSha256,
	})
	if err != nil {
		return nil, err
	}
	return out.Signature, nil // DER-encoded ECDSA; go-jose will convert to r||s for JWS.
}

func parseECDSAPublicKeyFromPEM(pemData string) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("invalid PEM")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	ec, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("PEM is not ECDSA public key")
	}
	return ec, nil
}

// NewKMSSigner constructs a crypto.Signer backed by AWS KMS (ES256).
func NewKMSSigner(ctx context.Context, keyID, publicPEM string) (*kmsECDSASigner, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	pub, err := parseECDSAPublicKeyFromPEM(publicPEM)
	if err != nil {
		return nil, err
	}
	return &kmsECDSASigner{
		kms:   kms.NewFromConfig(cfg),
		keyID: keyID,
		pub:   pub,
	}, nil
}
