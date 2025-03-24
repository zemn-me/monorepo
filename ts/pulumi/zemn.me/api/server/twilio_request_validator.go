package apiserver

import (
	"net/http"

	"github.com/twilio/twilio-go/client"
)

type TwilioRequestValidator struct {
	client.RequestValidator
}

func (t TwilioRequestValidator) Validate(rq *http.Request) bool {
	if err := rq.ParseForm(); err != nil {
		return false // probably should return the error at some point...
	}

	// for some reason twilio's api doesn't take the standard format...
	fields := make(map[string]string)
	// this will clearly break if there are dupe fields.
	for k, v := range map[string][]string(rq.PostForm) {
		fields[k] = v[0] // i think must be at least one...
	}

	return t.RequestValidator.Validate(
		rq.URL.String(),
		fields,
		rq.Header.Get("X-Twilio-Signature"),
	)
}
