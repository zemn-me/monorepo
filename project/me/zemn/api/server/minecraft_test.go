package apiserver

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type fakeMinecraftRCON struct {
	commands  []string
	err       error
	responses map[string]string
}

type fakeMinecraftWake struct {
	err     error
	reasons []string
}

func (f *fakeMinecraftRCON) Command(ctx context.Context, command string) (string, error) {
	f.commands = append(f.commands, command)
	if f.err != nil {
		return "", f.err
	}
	if f.responses != nil {
		return f.responses[command], nil
	}
	return "", nil
}

func (f *fakeMinecraftWake) Wake(ctx context.Context, reason string) error {
	f.reasons = append(f.reasons, reason)
	return f.err
}

func minecraftTestContext(subject string) context.Context {
	return context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Subject: subject,
		Issuer:  "https://api.zemn.me",
		Email:   subject + "@example.com",
	})
}

func TestParseMinecraftListResponse(t *testing.T) {
	online, max, err := parseMinecraftListResponse("There are 2 of a max of 20 players online: zemnmez, alex")
	if err != nil {
		t.Fatalf("parse list response: %v", err)
	}
	if online != 2 || max != 20 {
		t.Fatalf("unexpected player counts: online=%d max=%d", online, max)
	}
}

func TestGetMinecraftStatusFromRCON(t *testing.T) {
	s := newTestServer()
	rcon := &fakeMinecraftRCON{
		responses: map[string]string{
			"list": "There are 1 of a max of 20 players online: zemnmez",
		},
	}
	s.minecraftRCON = rcon

	resp, err := s.GetMinecraftStatus(context.Background(), GetMinecraftStatusRequestObject{})
	if err != nil {
		t.Fatalf("get minecraft status: %v", err)
	}
	status, ok := resp.(GetMinecraftStatus200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if status.OnlinePlayers != 1 || status.MaxPlayers == nil || *status.MaxPlayers != 20 || !status.RconReachable || status.ServerState != minecraftServerStateOnline {
		t.Fatalf("unexpected status: %#v", status)
	}
	if !reflect.DeepEqual(rcon.commands, []string{"list"}) {
		t.Fatalf("unexpected rcon commands: %#v", rcon.commands)
	}
}

func TestGetMinecraftStatusToleratesOfflineRCON(t *testing.T) {
	s := newTestServer()
	s.minecraftRCON = &fakeMinecraftRCON{err: errors.New("dial tcp: connection refused")}

	resp, err := s.GetMinecraftStatus(context.Background(), GetMinecraftStatusRequestObject{})
	if err != nil {
		t.Fatalf("get minecraft status: %v", err)
	}
	status := resp.(GetMinecraftStatus200JSONResponse)
	if status.RconReachable {
		t.Fatalf("expected unreachable rcon status: %#v", status)
	}
	if status.ServerState != minecraftServerStateOffline {
		t.Fatalf("expected offline server state: %#v", status)
	}
	if status.OnlinePlayers != 0 {
		t.Fatalf("expected zero online players on unreachable rcon, got %d", status.OnlinePlayers)
	}
}

func TestPostMinecraftWakeInvokesWakeRequester(t *testing.T) {
	s := newTestServer()
	wake := &fakeMinecraftWake{}
	s.minecraftWake = wake

	resp, err := s.PostMinecraftWake(context.Background(), PostMinecraftWakeRequestObject{})
	if err != nil {
		t.Fatalf("post minecraft wake: %v", err)
	}
	wakeResp, ok := resp.(PostMinecraftWake202JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if !wakeResp.WakeRequested {
		t.Fatalf("wake response did not mark request accepted: %#v", wakeResp)
	}
	if !reflect.DeepEqual(wake.reasons, []string{"minecraft page load"}) {
		t.Fatalf("unexpected wake reasons: %#v", wake.reasons)
	}
}

func TestPostMinecraftWakeReportsUnavailableBridge(t *testing.T) {
	s := newTestServer()

	resp, err := s.PostMinecraftWake(context.Background(), PostMinecraftWakeRequestObject{})
	if err != nil {
		t.Fatalf("post minecraft wake: %v", err)
	}
	if _, ok := resp.(PostMinecraftWake503JSONResponse); !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
}

func TestPutMinecraftWhitelistStoresOneUsernameAndAddsWhitelist(t *testing.T) {
	s := newTestServer()
	rcon := &fakeMinecraftRCON{}
	s.minecraftRCON = rcon

	resp, err := s.PutMinecraftWhitelist(minecraftTestContext("integration-test-local"), PutMinecraftWhitelistRequestObject{
		Body: &MinecraftWhitelistUpdate{Username: "zemnmez"},
	})
	if err != nil {
		t.Fatalf("put minecraft whitelist: %v", err)
	}
	updated := resp.(PutMinecraftWhitelist200JSONResponse)
	if updated.Username == nil || *updated.Username != "zemnmez" {
		t.Fatalf("unexpected whitelist response: %#v", updated)
	}
	if !reflect.DeepEqual(rcon.commands, []string{"whitelist add zemnmez"}) {
		t.Fatalf("unexpected rcon commands: %#v", rcon.commands)
	}

	rec, err := s.findUserByLocalID(context.Background(), "integration-test-local")
	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	if rec == nil || rec.MinecraftUsername != "zemnmez" {
		t.Fatalf("username was not stored: %#v", rec)
	}
	if !containsString(rec.Scopes, "minecraft") {
		t.Fatalf("hardcoded user scopes were not preserved: %#v", rec.Scopes)
	}
}

func TestPutMinecraftWhitelistReplacesPreviousUsername(t *testing.T) {
	s := newTestServer()
	if err := s.putUserRecord(context.Background(), userRecord{
		Id:                "user-1",
		When:              Now(),
		Scopes:            []string{"minecraft"},
		MinecraftUsername: "old_name",
	}); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	rcon := &fakeMinecraftRCON{}
	s.minecraftRCON = rcon

	_, err := s.PutMinecraftWhitelist(minecraftTestContext("user-1"), PutMinecraftWhitelistRequestObject{
		Body: &MinecraftWhitelistUpdate{Username: "new_name"},
	})
	if err != nil {
		t.Fatalf("put minecraft whitelist: %v", err)
	}
	want := []string{"whitelist add new_name", "whitelist remove old_name"}
	if !reflect.DeepEqual(rcon.commands, want) {
		t.Fatalf("unexpected rcon commands: got %#v want %#v", rcon.commands, want)
	}
}

func TestPutMinecraftWhitelistRejectsInvalidUsername(t *testing.T) {
	s := newTestServer()
	rcon := &fakeMinecraftRCON{}
	s.minecraftRCON = rcon

	resp, err := s.PutMinecraftWhitelist(minecraftTestContext("integration-test-local"), PutMinecraftWhitelistRequestObject{
		Body: &MinecraftWhitelistUpdate{Username: "not valid"},
	})
	if err != nil {
		t.Fatalf("put minecraft whitelist: %v", err)
	}
	if _, ok := resp.(PutMinecraftWhitelist400JSONResponse); !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if len(rcon.commands) != 0 {
		t.Fatalf("invalid username should not call rcon: %#v", rcon.commands)
	}
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}
