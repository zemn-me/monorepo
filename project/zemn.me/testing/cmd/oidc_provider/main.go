package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/zemn-me/monorepo/project/zemn.me/testing/oidc"
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
			"response_types_supported": []string{"id_token"},
			"subject_types_supported":  []string{"public"},
			"scopes_supported":         []string{"openid"},
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
	if responseType != "" && responseType != "id_token" {
		return fmt.Errorf("unsupported response_type %q", responseType)
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

	token, err := oidc.MintIDToken(subject, tokenAudience, issuer, values.Get("nonce"), extraClaims)
	if err != nil {
		return fmt.Errorf("mint id token: %w", err)
	}

	redirect, err := url.Parse(redirectURI)
	if err != nil {
		return fmt.Errorf("invalid redirect_uri: %w", err)
	}

	fragment := url.Values{}
	fragment.Set("id_token", token)
	if state := values.Get("state"); state != "" {
		fragment.Set("state", state)
	}

	redirect.Fragment = fragment.Encode()
	http.Redirect(w, r, redirect.String(), http.StatusFound)
	return nil
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
