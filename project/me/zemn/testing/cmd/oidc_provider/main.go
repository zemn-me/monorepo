package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/zemn-me/monorepo/project/me/zemn/testing/oidc"
)

func main() {
	port := flag.String("port", ":43111", "listen address")
	flag.Parse()

	addr := *port
	if !strings.HasPrefix(addr, ":") {
		addr = ":" + addr
	}

	portString := strings.TrimPrefix(addr, ":")
	if portString == "" {
		portString = "43111"
	}
	issuer := fmt.Sprintf("http://localhost:%s", portString)

	http.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer":                   issuer,
			"authorization_endpoint":   issuer + "/authorize",
			"jwks_uri":                 issuer + "/jwks",
			"response_types_supported": []string{"id_token", "id_token token"},
			"subject_types_supported":  []string{"public"},
			"scopes_supported":         []string{"openid", "https://www.googleapis.com/auth/contacts.readonly"},
			"claims_supported":         []string{},
		})
	})

	http.HandleFunc("/jwks", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_ = json.NewEncoder(w).Encode(oidc.JWKS())
	})

	http.HandleFunc("/authorize", makeAuthorizeHandler(issuer))

	log.Printf("OIDC test provider listening on %s (issuer %s)", addr, issuer)
	log.Fatal(http.ListenAndServe(addr, http.DefaultServeMux))
}

func makeAuthorizeHandler(issuer string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleAuthorizeGet(w, r, issuer)
		case http.MethodPost:
			handleAuthorizePost(w, r, issuer)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func handleAuthorizeGet(w http.ResponseWriter, r *http.Request, issuer string) {
	values := copyValues(r.URL.Query())

	subject := values.Get("subject")
	if subject == "" {
		subject = oidc.RemoteSubject
	}

	if values.Get("prompt") == "none" || values.Get("auto") == "1" {
		if err := issueIDToken(w, r, issuer, values, subject); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}

	renderAuthorizeForm(w, values, subject, issuer)
}

func handleAuthorizePost(w http.ResponseWriter, r *http.Request, issuer string) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, fmt.Sprintf("parse form: %v", err), http.StatusBadRequest)
		return
	}
	values := r.PostForm

	subject := values.Get("subject")
	if subject == "" {
		subject = oidc.RemoteSubject
	}

	if err := issueIDToken(w, r, issuer, values, subject); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
}

func issueIDToken(w http.ResponseWriter, r *http.Request, issuer string, values url.Values, subject string) error {
	clientID := values.Get("client_id")
	if clientID == "" {
		return fmt.Errorf("missing client_id")
	}
	redirectURI := values.Get("redirect_uri")
	if redirectURI == "" {
		return fmt.Errorf("missing redirect_uri")
	}

	responseType := values.Get("response_type")
	responseParts := parseResponseType(responseType)
	if responseType != "" && len(responseParts) == 0 {
		return fmt.Errorf("unsupported response_type %q", responseType)
	}

	requestsIDToken := responseType == "" || responseParts["id_token"]
	requestsAccessToken := responseParts["token"]

	nonce := values.Get("nonce")
	if requestsIDToken && nonce == "" {
		return fmt.Errorf("Nonce required for response_type id_token.")
	}

	tokenAudience := "zemn.me"
	extraClaims := map[string]any{}
	if audience := values.Get("audience"); audience != "" {
		tokenAudience = audience
	}
	if clientID != "" && clientID != tokenAudience {
		extraClaims["azp"] = clientID
		extraClaims["aud"] = []string{tokenAudience, clientID}
	}

	var accessToken string
	if requestsAccessToken {
		var err error
		accessToken, err = mintAccessToken()
		if err != nil {
			return fmt.Errorf("mint access token: %w", err)
		}
		extraClaims["at_hash"] = accessTokenHash(accessToken)
	}

	token, err := oidc.MintIDToken(subject, tokenAudience, issuer, nonce, extraClaims)
	if err != nil {
		return fmt.Errorf("mint id token: %w", err)
	}

	redirect, err := url.Parse(redirectURI)
	if err != nil {
		return fmt.Errorf("invalid redirect_uri: %w", err)
	}

	responseMode := values.Get("response_mode")
	params := url.Values{}
	if requestsIDToken {
		params.Set("id_token", token)
	}
	if requestsAccessToken {
		params.Set("access_token", accessToken)
		params.Set("token_type", "Bearer")
		params.Set("expires_in", "300")
	}
	if state := values.Get("state"); state != "" {
		params.Set("state", state)
	}

	switch responseMode {
	case "", "fragment":
		redirectWithFragment(w, r, redirect, params)
	case "query":
		redirectWithQuery(w, r, redirect, params)
	case "form_post":
		return respondFormPost(w, redirect.String(), params)
	default:
		return fmt.Errorf("unsupported response_mode %q", responseMode)
	}
	return nil
}

func redirectWithFragment(w http.ResponseWriter, r *http.Request, redirect *url.URL, params url.Values) {
	existing := redirect.Fragment
	combined := url.Values{}
	if existing != "" {
		if parsed, err := url.ParseQuery(existing); err == nil {
			for k, vals := range parsed {
				for _, v := range vals {
					combined.Add(k, v)
				}
			}
		}
	}
	for k, vals := range params {
		for _, v := range vals {
			combined.Set(k, v)
		}
	}
	redirect.Fragment = combined.Encode()
	http.Redirect(w, r, redirect.String(), http.StatusFound)
}

func redirectWithQuery(w http.ResponseWriter, r *http.Request, redirect *url.URL, params url.Values) {
	query := redirect.Query()
	for k, vals := range params {
		for _, v := range vals {
			query.Set(k, v)
		}
	}
	redirect.RawQuery = query.Encode()
	http.Redirect(w, r, redirect.String(), http.StatusFound)
}

func respondFormPost(w http.ResponseWriter, action string, params url.Values) error {
	tmpl := `<html><head><title>OIDC Response</title></head><body>
<form method="post" action="{{.Action}}" id="oidc-form">
{{range $key, $vals := .Params}}{{range $vals}}
<input type="hidden" name="{{$key}}" value="{{.}}">
{{end}}{{end}}
<noscript>
<p>JavaScript is disabled. Click the button below to continue.</p>
<button type="submit">Continue</button>
</noscript>
</form>
<script>document.getElementById('oidc-form').submit();</script>
</body></html>`
	t, err := template.New("form_post").Parse(tmpl)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	return t.Execute(w, struct {
		Action string
		Params url.Values
	}{
		Action: action,
		Params: params,
	})
}

func renderAuthorizeForm(w http.ResponseWriter, values url.Values, subject string, issuer string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")

	fmt.Fprintf(w, "<!doctype html><html><head><title>Test Identity Provider</title></head><body>")
	fmt.Fprintf(w, "<h1>Test Identity Provider</h1>")
	fmt.Fprintf(w, "<p>Issuer: %s</p>", template.HTMLEscapeString(issuer))
	fmt.Fprintf(w, "<p>Client ID: %s</p>", template.HTMLEscapeString(values.Get("client_id")))
	fmt.Fprintf(w, "<p>Redirect URI: %s</p>", template.HTMLEscapeString(values.Get("redirect_uri")))

	fmt.Fprintf(w, "<h2>Login</h2>")
	fmt.Fprintf(w, `<form method="post">`)
	writeHiddenFields(w, values)
	fmt.Fprintf(w, `<label>Subject: <input name="subject" value="%s" autocomplete="username"></label><br>`, template.HTMLEscapeString(subject))
	fmt.Fprintf(w, `<button type="submit">Issue id_token</button>`)
	fmt.Fprintf(w, `</form>`)

	fmt.Fprintf(w, "<h3>Quick actions</h3>")
	renderQuickForm(w, values, "Login as remote subject", oidc.RemoteSubject)
	renderQuickForm(w, values, "Login as local subject", oidc.LocalSubject)

	fmt.Fprintf(w, "</body></html>")
}

func renderQuickForm(w http.ResponseWriter, values url.Values, label, subject string) {
	fmt.Fprintf(w, `<form method="post" style="display:inline-block;margin-right:8px;">`)
	writeHiddenFields(w, values)
	fmt.Fprintf(w, `<input type="hidden" name="subject" value="%s">`, template.HTMLEscapeString(subject))
	fmt.Fprintf(w, `<button type="submit">%s</button>`, template.HTMLEscapeString(label))
	fmt.Fprintf(w, `</form>`)
}

func writeHiddenFields(w http.ResponseWriter, values url.Values) {
	for _, key := range []string{"client_id", "redirect_uri", "response_type", "scope", "state", "nonce", "audience"} {
		for _, v := range values[key] {
			fmt.Fprintf(w, `<input type="hidden" name="%s" value="%s">`, template.HTMLEscapeString(key), template.HTMLEscapeString(v))
		}
	}
}

func copyValues(in url.Values) url.Values {
	out := make(url.Values, len(in))
	for k, vs := range in {
		copied := make([]string, len(vs))
		copy(copied, vs)
		out[k] = copied
	}
	return out
}

func parseResponseType(responseType string) map[string]bool {
	parts := strings.Fields(responseType)
	if len(parts) == 0 {
		return map[string]bool{}
	}
	known := map[string]bool{}
	for _, part := range parts {
		switch part {
		case "id_token", "token":
			known[part] = true
		default:
			return map[string]bool{}
		}
	}
	if !known["id_token"] {
		return map[string]bool{}
	}
	return known
}

func mintAccessToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func accessTokenHash(accessToken string) string {
	sum := sha256.Sum256([]byte(accessToken))
	return base64.RawURLEncoding.EncodeToString(sum[:len(sum)/2])
}
