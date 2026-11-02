package apiserver

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"errors"
	"io"
	"math/big"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
	jose "github.com/go-jose/go-jose/v4"
)

type kmsECDSASigner struct {
	kms   *kms.Client
	keyID string
	pub   *ecdsa.PublicKey
}

var _ crypto.Signer = (*kmsECDSASigner)(nil)

func (s *kmsECDSASigner) Public() crypto.PublicKey { return s.pub }

// Sign expects a SHA-256 digest (32 bytes) and returns DER-encoded ECDSA.
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
	return out.Signature, nil // DER-encoded ECDSA
}

func parseECDSAPublicKeyFromPEM(pemData string) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("invalid PEM")
	}
	pubAny, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	pub, ok := pubAny.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("PEM is not ECDSA public key")
	}
	return pub, nil
}

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

// ===== OpaqueSigner for go-jose v4 =====

type kmsOpaqueSigner struct {
	kms   *kms.Client
	keyID string
	pub   *ecdsa.PublicKey
}

var _ jose.OpaqueSigner = (*kmsOpaqueSigner)(nil)

// NewKMSOpaqueSigner constructs a jose.OpaqueSigner backed by AWS KMS (ES256).
func NewKMSOpaqueSigner(ctx context.Context, keyID, publicPEM string) (*kmsOpaqueSigner, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	pub, err := parseECDSAPublicKeyFromPEM(publicPEM)
	if err != nil {
		return nil, err
	}
	return &kmsOpaqueSigner{
		kms:   kms.NewFromConfig(cfg),
		keyID: keyID,
		pub:   pub,
	}, nil
}

// Public returns the JWK for headers (kid set to KMS keyID).
func (s *kmsOpaqueSigner) Public() *jose.JSONWebKey {
	return &jose.JSONWebKey{
		Key:       s.pub,
		KeyID:     s.keyID,
		Algorithm: string(jose.ES256),
		Use:       "sig",
	}
}

// Algs declares supported algorithms.
func (s *kmsOpaqueSigner) Algs() []jose.SignatureAlgorithm {
	return []jose.SignatureAlgorithm{jose.ES256}
}

// SignPayload signs the JWS signing input. We let KMS hash (MessageType=RAW),
// then convert DER to JOSE r||s.
func (s *kmsOpaqueSigner) SignPayload(payload []byte, alg jose.SignatureAlgorithm) ([]byte, error) {
	if alg != jose.ES256 {
		return nil, jose.ErrUnsupportedAlgorithm
	}
	out, err := s.kms.Sign(context.Background(), &kms.SignInput{
		KeyId:            &s.keyID,
		Message:          payload,
		MessageType:      types.MessageTypeRaw, // KMS does the SHA-256 for ES256
		SigningAlgorithm: types.SigningAlgorithmSpecEcdsaSha256,
	})
	if err != nil {
		return nil, err
	}
	return derToJOSE(out.Signature, (s.pub.Curve.Params().BitSize+7)/8)
}

// derToJOSE converts ASN.1 DER ECDSA sig to fixed-length r||s per JOSE.
func derToJOSE(der []byte, size int) ([]byte, error) {
	var sig struct {
		R, S *big.Int
	}
	if _, err := asn1.Unmarshal(der, &sig); err != nil || sig.R == nil || sig.S == nil {
		return nil, errors.New("invalid ECDSA signature DER")
	}
	r := sig.R.Bytes()
	s := sig.S.Bytes()
	out := make([]byte, 2*size)
	copy(out[size-len(r):size], r)
	copy(out[2*size-len(s):], s)
	return out, nil
}
