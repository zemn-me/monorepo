package apiserver

import (
	"bytes"
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
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

type fakeMinecraftLogs struct {
	events    []MinecraftLogEvent
	err       error
	afterCall func()
}

type fakeMinecraftCloudWatchLogsClient struct {
	input  *cloudwatchlogs.FilterLogEventsInput
	output *cloudwatchlogs.FilterLogEventsOutput
	err    error
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

func (f *fakeMinecraftLogs) LogEvents(ctx context.Context, since time.Time) ([]MinecraftLogEvent, error) {
	if f.afterCall != nil {
		defer f.afterCall()
	}
	if f.err != nil {
		return nil, f.err
	}
	return f.events, nil
}

func (f *fakeMinecraftCloudWatchLogsClient) FilterLogEvents(ctx context.Context, input *cloudwatchlogs.FilterLogEventsInput, optFns ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.FilterLogEventsOutput, error) {
	f.input = input
	if f.err != nil {
		return nil, f.err
	}
	return f.output, nil
}

func minecraftTestContext(subject string) context.Context {
	return context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Subject: subject,
		Issuer:  "https://api.zemn.me",
		Email:   subject + "@example.com",
	})
}

func TestCloudWatchMinecraftLogTailerMapsEvents(t *testing.T) {
	client := &fakeMinecraftCloudWatchLogsClient{
		output: &cloudwatchlogs.FilterLogEventsOutput{
			Events: []types.FilteredLogEvent{
				{
					EventId:       aws.String("later"),
					LogStreamName: aws.String("minecraft/1"),
					Message:       aws.String("second\n"),
					Timestamp:     aws.Int64(2000),
				},
				{
					EventId:       aws.String("earlier"),
					LogStreamName: aws.String("minecraft/1"),
					Message:       aws.String("first"),
					Timestamp:     aws.Int64(1000),
				},
			},
		},
	}
	tailer := cloudWatchMinecraftLogTailer{
		client:       client,
		logGroupName: "minecraft-logs",
	}

	events, err := tailer.LogEvents(context.Background(), time.Unix(0, 0))
	if err != nil {
		t.Fatalf("log events: %v", err)
	}
	if aws.ToString(client.input.LogGroupName) != "minecraft-logs" {
		t.Fatalf("unexpected log group: %#v", client.input.LogGroupName)
	}
	if len(events) != 2 {
		t.Fatalf("unexpected events: %#v", events)
	}
	if events[0].Id != "earlier" || events[0].Message != "first" {
		t.Fatalf("events were not sorted and mapped: %#v", events)
	}
	if events[1].Message != "second" {
		t.Fatalf("event message was not trimmed: %#v", events[1])
	}
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

func TestGetMinecraftEventsReportsUnavailableLogStream(t *testing.T) {
	s := newTestServer()

	resp, err := s.GetMinecraftEvents(context.Background(), GetMinecraftEventsRequestObject{})
	if err != nil {
		t.Fatalf("get minecraft events: %v", err)
	}
	if _, ok := resp.(GetMinecraftEvents503JSONResponse); !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
}

func TestWriteMinecraftEventStreamWritesLogEvents(t *testing.T) {
	s := newTestServer()
	ctx, cancel := context.WithCancel(context.Background())
	s.minecraftLogs = &fakeMinecraftLogs{
		events: []MinecraftLogEvent{
			{
				Id:        "event-1",
				Message:   "[Server thread/INFO]: <zemnmez> hello",
				Timestamp: time.Unix(1700000000, 0).UTC(),
			},
		},
		afterCall: cancel,
	}

	var body bytes.Buffer
	if err := s.writeMinecraftEventStream(ctx, &body); err != nil {
		t.Fatalf("write event stream: %v", err)
	}
	got := body.String()
	for _, want := range []string{
		"retry: 3000\n\n",
		"id: event-1\n",
		"event: minecraft.log\n",
		`"message":"[Server thread/INFO]: \u003czemnmez\u003e hello"`,
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("event stream missing %q:\n%s", want, got)
		}
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
