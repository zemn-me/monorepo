package oidc

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
	"sync"

	"github.com/go-jose/go-jose/v4"
)

const (
	Issuer        = "http://localhost:43111"
	ClientID      = "integration-test-client"
	RemoteSubject = "integration-test-remote"
	LocalSubject  = "integration-test-local"
	signingKeyPEM = `-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCNpgylKE8rY58cCGoUJhyIOyHUV3CnwpE898OOhxoRlDP+bflN
01qwpOigCSEwX3X8XYHWZO+bs5iiDsr4KEC+et6wmvDYKi6NRgN5dQMRCQ1/gJFE
feIBcXzZHBglV5+pcrkaAGsAUneS/tGP99qHvCs5qsxL/jvaWvtob0WpVwIDAQAB
AoGBAIJ1BzppKJk2lEjWOxS5kRerFloh+kCXwvoa2wH+zfSYwVY4ZR7XZLRB/Xm/
TtDlap32ZOlXZxLI0u+Wnjr1n8IpDAvuj+j8UKi8o8+fSarvoViy0+Gx358Iyeu3
MGXlY5g/p3sxJLFkrkgwjMWiUYT0zXGbw3Ei4yS6dvuBbLDBAkEA6WYMOBzIzWZ3
QooraOvNquAAwDDN4JCd7x/ismZI43XjXWW3ptmX2GE7lrsRzmZFvf94GFwcqVmb
Q7nlBw/34QJBAJtdhOiqy09a7Ge+fNhfETafS8dm9Fx/OHECCjXzV5ELVeeFXCV+
coBxLXyEsHEpNP3vmrvQ51e/7F7SBuKkaDcCQAyGcm9sdAY50nqaqZu209Gwtbma
pOHBQQh9IJBMVusF/46aj9F/adut1CHRpjH6YRHCLPK5trwL1/45cqX/YGECQHPr
iPkYRe2Fh5G4XOoLtIouvJmgxX4mJfSbcwbh81nzPTsrE5+eAsy2pRuc3RDxj+pP
1gGAUrv0JOZyilScGm0CQBLqgAbPQwR6LY0gv4MOesQuWzsa3j8PUZrO8qarwaQH
4v43ydyBhXP8wamkQMgNlNRzKos8m05HoRUC0hmZw6Y=
-----END RSA PRIVATE KEY-----`
)

var (
	keyOnce   sync.Once
	key       *rsa.PrivateKey
	publicJWK jose.JSONWebKey
)

func SigningKey() *rsa.PrivateKey {
	keyOnce.Do(func() {
		block, _ := pem.Decode([]byte(signingKeyPEM))
		if block == nil {
			log.Fatalf("failed to decode RSA key")
		}
		parsedKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			log.Fatalf("parse rsa key: %v", err)
		}
		key = parsedKey
		publicJWK = jose.JSONWebKey{
			Key:       &key.PublicKey,
			KeyID:     "integration-test-key",
			Algorithm: string(jose.RS256),
			Use:       "sig",
		}
	})
	return key
}

func JWKS() jose.JSONWebKeySet {
	SigningKey()
	return jose.JSONWebKeySet{Keys: []jose.JSONWebKey{publicJWK}}
}

func KeyID() string {
	SigningKey()
	return publicJWK.KeyID
}
