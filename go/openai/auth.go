package openai

import (
	"net/http"
)

type Auth struct {
	ApiKey       []byte
	Organization []byte
	Project      []byte
}

// Generate a set of OpenAI auth headers. Note that
// it is not an error to omit the API key -- the request
// will fail at OpenAI's server.
func (a Auth) Headers() (h http.Header) {
	h = make(http.Header, 3)

	if a.ApiKey != nil {
		h["Authorization"] = []string{string(a.ApiKey)}
	}

	if a.Organization != nil {
		h["OpenAI-Organization"] = []string{string(a.Organization)}
	}

	if a.Project != nil {
		h["OpenAI-Project"] = []string{string(a.Project)}
	}

	return
}
