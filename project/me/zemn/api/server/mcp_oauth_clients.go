package apiserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"slices"
	"strings"
	"time"
)

type oauthClient struct {
	ID            string   `json:"client_id"`
	Name          string   `json:"client_name"`
	RedirectURIs  []string `json:"redirect_uris"`
	GrantTypes    []string `json:"grant_types"`
	ResponseTypes []string `json:"response_types"`
	AuthMethod    string   `json:"token_endpoint_auth_method"`
}

func validOAuthRedirect(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || len(raw) > 2048 || u.Host == "" || u.User != nil || strings.Contains(raw, "#") || u.Opaque != "" {
		return false
	}
	return u.Scheme == "https" || (u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "::1" || u.Hostname() == "localhost"))
}
func (c *oauthClient) validate() error {
	if c.Name == "" || len(c.Name) > 200 || len(c.RedirectURIs) == 0 || len(c.RedirectURIs) > 10 {
		return errors.New("client_name and 1–10 redirect_uris are required")
	}
	for _, uri := range c.RedirectURIs {
		if !validOAuthRedirect(uri) {
			return errors.New("redirect URIs must use HTTPS or HTTP loopback, without fragments")
		}
	}
	if c.AuthMethod == "" {
		c.AuthMethod = "none"
	}
	if c.AuthMethod != "none" {
		return errors.New("only public clients with PKCE and token_endpoint_auth_method none are supported")
	}
	if len(c.GrantTypes) == 0 {
		c.GrantTypes = []string{"authorization_code"}
	}
	for _, grant := range c.GrantTypes {
		if grant != "authorization_code" && grant != "refresh_token" {
			return errors.New("unsupported grant type")
		}
	}
	if !slices.Contains(c.GrantTypes, "authorization_code") {
		return errors.New("authorization_code is required")
	}
	if len(c.ResponseTypes) == 0 {
		c.ResponseTypes = []string{"code"}
	}
	if len(c.ResponseTypes) != 1 || c.ResponseTypes[0] != "code" {
		return errors.New("only code responses are supported")
	}
	return nil
}

// Resolve and dial the same vetted IP, preventing DNS rebinding and requests to
// private infrastructure. Never forward cookies, credentials, or redirects.
func oauthPublicIP(addr netip.Addr) bool {
	addr = addr.Unmap()
	if addr.Is6() && !netip.MustParsePrefix("2000::/3").Contains(addr) {
		return false
	}
	if !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() {
		return false
	}
	for _, prefix := range []string{"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4", "2001:db8::/32", "2001::/23", "64:ff9b::/96", "64:ff9b:1::/48", "2002::/16"} {
		if netip.MustParsePrefix(prefix).Contains(addr) {
			return false
		}
	}
	return true
}
func oauthMetadataHTTPClient() *http.Client {
	return &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, Transport: &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
			if err != nil {
				return nil, err
			}
			if len(ips) == 0 {
				return nil, errors.New("no client metadata address")
			}
			for _, ip := range ips {
				if !oauthPublicIP(ip) {
					return nil, errors.New("client metadata address is not public")
				}
			}
			var dialer net.Dialer
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
		},
	}}
}
func (s *Server) oauthResolveClient(ctx context.Context, id string) (oauthClient, error) {
	var c oauthClient
	if !strings.HasPrefix(id, "https://") {
		_, err := s.oauthGet(ctx, "client", id, &c)
		return c, err
	}
	u, err := url.Parse(id)
	if err != nil || len(id) > 2048 || u.Host == "" || u.User != nil || strings.Contains(id, "#") || u.Path == "" || (u.Port() != "" && u.Port() != "443") {
		return c, errors.New("invalid client metadata URL")
	}
	return oauthFetchClientMetadata(ctx, id, oauthMetadataHTTPClient())
}

func oauthFetchClientMetadata(ctx context.Context, id string, client *http.Client) (oauthClient, error) {
	var c oauthClient
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, id, nil)
	if err != nil {
		return c, err
	}
	request.Header.Set("Accept", "application/json")
	defer client.CloseIdleConnections()
	response, err := client.Do(request)
	if err != nil {
		return c, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return c, errors.New("client metadata unavailable")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 16385))
	if err != nil || len(data) > 16384 {
		return c, errors.New("client metadata too large")
	}
	if err = json.Unmarshal(data, &c); err != nil {
		return c, err
	}
	if c.ID != id {
		return c, errors.New("client_id does not match its metadata URL")
	}
	return c, c.validate()
}
