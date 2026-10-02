package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"
)

const loginWindow = 12 * time.Hour

// LoginKeyContext separates author seeds by site and purpose. KMS applies
// HMAC-SHA256 to this message using the deployment's persistent master key.
func LoginKeyContext(origin, email string) []byte {
	return []byte("bowery-bugle:email-login:v1\x00" + origin + "\x00" + strings.ToLower(strings.TrimSpace(email)))
}

// totp implements RFC 6238's SHA-256 variant with eight decimal digits.
func totp(key []byte, counter uint64) string {
	var message [8]byte
	binary.BigEndian.PutUint64(message[:], counter)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(message[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 15
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%08d", value%100000000)
}

func (s *Server) loginCode(now time.Time) (string, time.Time, error) {
	if len(s.LoginKey) != 32 {
		return "", time.Time{}, errors.New("login key must be 32 bytes")
	}
	step := now.Unix() / int64(loginWindow/time.Second)
	return totp(s.LoginKey, uint64(step)), time.Unix((step+1)*int64(loginWindow/time.Second), 0).UTC(), nil
}

type LoginEmail struct {
	Link    string
	Code    string
	Expires time.Time
}

func (m LoginEmail) body() string {
	return fmt.Sprintf("Use this link to log in and upload issues of The Bowery Bugle:\n\n%s\n\nLogin code: %s\n\nThis code is valid for the current 12-hour login window, which ends on %s. You can use this link more than once until that time. Requesting another email during the same window sends the same code.\n\nIf you did not request this email, you can ignore it.", m.Link, m.Code, m.Expires.UTC().Format("January 2, 2006 at 15:04 MST"))
}
