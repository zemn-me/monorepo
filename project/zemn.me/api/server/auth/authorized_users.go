package auth

import (
	"encoding"
	"fmt"
	"net/url"
)

type Identity struct {
	Issuer  string `json:"iss"`
	Subject string `json:"sub"`
}

var AuthorizedUsers = []Identity{
	{
		// thomas
		Issuer:  "https://accounts.google.com",
		Subject: "111669004071516300752",
	},
	{
		// keng1
		Issuer:  "https://accounts.google.com",
		Subject: "112149295011396650000",
	},
	{
		// keng2
		Issuer:  "https://accounts.google.com",
		Subject: "112149295011396651358",
	},
}

// returns true if a set of **verified** `id_token` claims
// are considered to represent this user.
func (a Identity) Is(b Identity) bool {
	return a.TryIs(b) == nil
}

func (a Identity) TryIs(b Identity) (err error) {
	// if the issuer is not the same, we can't compare.
	if a.Issuer != b.Issuer {
		return fmt.Errorf("issuer mismatch: %q != %q", a.Issuer, b.Issuer)
	}

	// if the subject is not the same, we can't compare.
	if a.Subject != b.Subject {
		return fmt.Errorf("subject mismatch: %q != %q", a.Subject, b.Subject)
	}

	return nil
}

func (a Identity) IssuerURL() (*url.URL, error) {
	return url.Parse(a.Issuer)
}

var (
	_ fmt.Stringer           = Identity{}
	_ encoding.TextMarshaler = Identity{}
)

func (a Identity) MarshalText() (i []byte, err error) {
	u, err := a.IssuerURL()
	if err != nil {
		return
	}

	u.User = url.User(a.Subject)

	return []byte(u.String()), nil
}

func (a *Identity) UnmarshalText(i []byte) error {
	u, err := url.Parse(string(i))
	if err != nil {
		return err
	}

	if u.User.Username() == "" {
		return fmt.Errorf("invalid identity; missing user part: %s", i)
	}

	a.Subject = u.User.Username()

	_, hasPassword := u.User.Password()
	if hasPassword {
		return fmt.Errorf("invalid identity; user part should not have password: %s", i)
	}

	u.User = nil

	a.Issuer = u.String()

	if a.Subject == "" {
		return fmt.Errorf("invalid identity; missing subject part: %s", i)
	}

	return nil
}

func (a Identity) String() string {
	var err error
	var b []byte
	if b, err = a.MarshalText(); err == nil {
		return string(b)
	}

	return fmt.Sprintf("[ INVALID IDENTITY %v ] %s|%s", err, a.Issuer, a.Subject)
}
