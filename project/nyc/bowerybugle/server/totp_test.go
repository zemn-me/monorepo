package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"strings"
	"testing"
	"time"
)

func TestTOTPRFC6238SHA256Vectors(t *testing.T) {
	// Published SHA-256, eight-digit vectors, evaluated at the RFC's 30s step.
	key := []byte("12345678901234567890123456789012")
	for _, test := range []struct {
		seconds uint64
		want    string
	}{
		{59, "46119246"}, {1111111109, "68084774"}, {1111111111, "67062674"},
		{1234567890, "91819424"}, {2000000000, "90698825"}, {20000000000, "77737706"},
	} {
		if got := totp(key, test.seconds/30); got != test.want {
			t.Errorf("at %d: got %s, want %s", test.seconds, got, test.want)
		}
	}
}

func TestTwelveHourWindowAndEmail(t *testing.T) {
	f := setup()
	start := time.Unix(f.now.Unix()/43200*43200, 0)
	f.now = start
	code := f.challenge(t)
	email := f.mail.messages[0]
	if email.Code != code || !email.Expires.Equal(start.Add(12*time.Hour)) {
		t.Fatal("incorrect emailed code or expiry")
	}
	body := email.body()
	for _, expected := range []string{"12-hour", "more than once", code, email.Link, email.Expires.UTC().Format("January 2, 2006 at 15:04 MST")} {
		if !strings.Contains(body, expected) {
			t.Fatalf("email missing %q", expected)
		}
	}
	if strings.Contains(body, "10 minutes") || strings.Contains(body, "only be used once") {
		t.Fatal("email has obsolete validity wording")
	}
	f.now = start.Add(6 * time.Hour)
	if repeated := f.challenge(t); repeated != code {
		t.Fatal("code changed within its window")
	}
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 200)
	f.now = start.Add(12*time.Hour - time.Second)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 200)
	f.now = start.Add(12 * time.Hour)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 400)
	fresh := f.challenge(t)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": fresh}, nil), 200)
	for key := range f.store.records {
		if strings.HasPrefix(key, "challenge/") {
			t.Fatal("per-request challenge storage was used")
		}
	}
}

func TestVerificationLimitsAndMissingKey(t *testing.T) {
	f := setup()
	code, _, err := f.server.loginCode(f.now)
	if err != nil {
		t.Fatal(err)
	}
	wrong := string('0'+(code[0]-'0'+1)%10) + code[1:]
	for range 10 {
		status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": wrong}, nil), 400)
	}
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 429)
	f.now = f.now.Add(time.Minute)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 200)
	f = setup()
	code, _, _ = f.server.loginCode(f.now)
	f.server.LoginKey = nil
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 503)
	status(t, f.request("POST", "/api/login", map[string]string{"email": f.server.Author}, nil), 503)
	if len(f.mail.links) != 0 {
		t.Fatal("sent code without configured key")
	}
}

func TestSeedDerivationSeparatesEmailAndSite(t *testing.T) {
	master := []byte("test master secret for seed derivation")
	seed := func(origin, email string) []byte {
		m := hmac.New(sha256.New, master)
		_, _ = m.Write(LoginKeyContext(origin, email))
		return m.Sum(nil)
	}
	original := seed("https://bugle.example.test", "author@example.test")
	if !hmac.Equal(original, seed("https://bugle.example.test", " AUTHOR@example.test ")) {
		t.Fatal("email normalization changed seed")
	}
	if hmac.Equal(original, seed("https://staging.example.test", "author@example.test")) || hmac.Equal(original, seed("https://bugle.example.test", "other@example.test")) {
		t.Fatal("seed shared across identities or sites")
	}
}

func TestVerificationWindowBudgetAndAdjacentCodes(t *testing.T) {
	f := setup()
	code, expires, _ := f.server.loginCode(f.now)
	future, _, _ := f.server.loginCode(expires)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": future}, nil), 400)
	f = setup()
	code, expires, _ = f.server.loginCode(f.now)
	wrong := string('0'+(code[0]-'0'+1)%10) + code[1:]
	for range 10 {
		for range 10 {
			status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": wrong}, nil), 400)
		}
		f.now = f.now.Add(time.Minute)
	}
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 429)
	f.now = expires
	code, _, _ = f.server.loginCode(f.now)
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": code}, nil), 200)
}
