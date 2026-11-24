package apiserver

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"errors"
	"math/big"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
	jose "github.com/go-jose/go-jose/v4"
)

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

type kmsOpaqueSigner struct {
	kms   *kms.Client
	keyID string
	pub   *ecdsa.PublicKey
}

var _ jose.OpaqueSigner = (*kmsOpaqueSigner)(nil)

func newKMSOpaqueSigner(cfg aws.Config, keyID, publicPEM string) (*kmsOpaqueSigner, error) {
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
