package apiserver

// some code stolen from  https://github.com/twilio/twilio-go/blob/437c49b32f84ac6ba84dfd0d6e327992bc99fd0d/client/request_validator_test.go

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/twilio/twilio-go/client"
)

const (
	testURL   = "https://mycompany.com/myapp.php?foo=1&bar=2"
	signature = "vOEb5UThFn24KEfnOFLQY2AE5FY=" // of the testURL above with the params below
	bodyHash  = "0a1ff7634d9ab3b95db5c9a2dfe9416e41502b283a80c7cf19632632f96e6620"
)

var (
	validator = TwilioRequestValidator{client.NewRequestValidator("12345")}
	params    = map[string]string{
		"Digits":                "1234",
		"CallSid":               "CA1234567890ABCDE",
		"To":                    "+18005551212",
		"Caller":                "+14158675309",
		"From":                  "+14158675309",
		"ReasonConferenceEnded": "test",
		"Reason":                "Participant",
	}
	jsonBody = []byte(`{"property": "value", "boolean": true}`)
	formBody = []byte(`property=value&boolean=true`)
)

func TestRequestValidator_Validate(t *testing.T) {
	values := make(url.Values)
	ctx := context.Background()

	for k, v := range params {
		values[k] = []string{v}
	}

	newRq := func(url string, signature string) *http.Request {
		r := httptest.NewRequestWithContext(
			ctx,
			"GET",
			url,
			strings.NewReader(
				values.Encode(), // why is this api not .String() ?
			),
		)

		r.Header.Set("X-Twilio-Signature", signature)

		return r
	}

	t.Parallel()

	t.Run("returns true when validation succeeds", func(t *testing.T) {
		assert.True(t, validator.Validate(newRq(testURL, signature)))
	})

	t.Run("returns false when validation fails", func(t *testing.T) {
		assert.False(t, validator.Validate(newRq(testURL, "WRONG SIGNATURE")))
	})

	t.Run("returns true when https and port is specified but signature is generated without it", func(t *testing.T) {
		theURL := strings.Replace(testURL, ".com", ".com:1234", 1)
		assert.True(t, validator.Validate(newRq(theURL, signature)))
	})

	t.Run("returns true when https and port is specified and signature is generated with it", func(t *testing.T) {
		expectedSignature := "vOEb5UThFn24KEfnOFLQY2AE5FY=" // hash of https uri without port
		assert.True(t, validator.Validate(newRq(testURL, expectedSignature)))
	})

	t.Run("returns true when http and port port is specified but signature is generated without it", func(t *testing.T) {
		theURL := strings.Replace(testURL, ".com", ".com", 1)
		theURL = strings.Replace(theURL, "https", "http", 1)
		expectedSignature := "n2xBNyzSW7rfYStDtOFiFMv7qNo=" // hash of http uri without port
		assert.True(t, validator.Validate(newRq(theURL, expectedSignature)))
	})

	t.Run("returns true when http and port is specified and signature is generated with it", func(t *testing.T) {
		theURL := strings.Replace(testURL, ".com", ".com:1234", 1)
		theURL = strings.Replace(theURL, "https", "http", 1)
		expectedSignature := "n2xBNyzSW7rfYStDtOFiFMv7qNo=" // hash of http uri with port 1234
		assert.True(t, validator.Validate(newRq(theURL, expectedSignature)))
	})

	t.Run("return false when params are sorted incorrectly", func(t *testing.T) {
		incorrectSignature := "95+Bu0JVPi0r/SsESZCVf0dWAjw=" // Params ReasonConferenceEnded is sorted before Reason
		assert.False(t, validator.Validate(newRq(testURL, incorrectSignature)))
	})
}
