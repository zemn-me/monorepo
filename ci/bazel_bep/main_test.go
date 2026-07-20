package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"

	bep "github.com/zemn-me/monorepo/ci/bazel_bep/build_event_stream_proto"
	"google.golang.org/protobuf/encoding/protodelim"
	"google.golang.org/protobuf/types/known/durationpb"
)

func TestAnnotateBEP(t *testing.T) {
	var stream bytes.Buffer
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_TestSummary{
				TestSummary: &bep.BuildEventId_TestSummaryId{Label: "//ci:tests"},
			},
		},
		Payload: &bep.BuildEvent_TestSummary{
			TestSummary: &bep.TestSummary{
				OverallStatus:    bep.TestStatus_PASSED,
				TotalRunDuration: durationpb.New(3700 * time.Millisecond),
			},
		},
	})
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_TargetCompleted{
				TargetCompleted: &bep.BuildEventId_TargetCompletedId{
					Label: "//.github/workflows:validation",
				},
			},
		},
		Payload: &bep.BuildEvent_Completed{
			Completed: &bep.TargetComplete{Success: false},
		},
	})

	var out bytes.Buffer
	if err := annotateBEP(&stream, &out); err != nil {
		t.Fatal(err)
	}

	const expected = "" +
		"::notice title=//ci%3Atests passed in 3.7s,file=ci/BUILD.bazel:://ci:tests PASSED\n" +
		"::error title=//.github/workflows%3Avalidation failed to build,file=.github/workflows/BUILD.bazel:://.github/workflows:validation failed to build\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestAnnotateBuildBuddyLinks(t *testing.T) {
	var stream bytes.Buffer
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_Progress{
				Progress: &bep.BuildEventId_ProgressId{},
			},
		},
		Payload: &bep.BuildEvent_Progress{
			Progress: &bep.Progress{
				Stderr: "Streaming build results to: https://app.buildbuddy.io/invocation/abc123",
			},
		},
	})
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_BuildToolLogs{
				BuildToolLogs: &bep.BuildEventId_BuildToolLogsId{},
			},
		},
		Payload: &bep.BuildEvent_BuildToolLogs{
			BuildToolLogs: &bep.BuildToolLogs{
				Log: []*bep.File{
					{
						Name: "BuildBuddy invocation",
						File: &bep.File_Uri{
							Uri: "https://app.buildbuddy.io/invocation/def456",
						},
					},
				},
			},
		},
	})

	var out bytes.Buffer
	if err := annotateBEP(&stream, &out); err != nil {
		t.Fatal(err)
	}

	const expected = "" +
		"::notice title=BuildBuddy invocation::https://app.buildbuddy.io/invocation/abc123\n" +
		"::notice title=BuildBuddy invocation::https://app.buildbuddy.io/invocation/def456\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestFailedLogs(t *testing.T) {
	dir := t.TempDir()
	log := filepath.Join(dir, "test.log")
	if err := os.WriteFile(log, []byte("nope\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stream bytes.Buffer
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_TestSummary{
				TestSummary: &bep.BuildEventId_TestSummaryId{Label: "//bin/host/ffmpeg:smoke"},
			},
		},
		Payload: &bep.BuildEvent_TestSummary{
			TestSummary: &bep.TestSummary{
				OverallStatus:    bep.TestStatus_FAILED,
				TotalRunDuration: durationpb.New(100 * time.Millisecond),
				Failed: []*bep.File{
					{
						File: &bep.File_Uri{
							Uri: "file://" + log,
						},
					},
				},
			},
		},
	})

	var out bytes.Buffer
	if err := annotateBEP(&stream, &out); err != nil {
		t.Fatal(err)
	}

	const expected = "::error title=//bin/host/ffmpeg%3Asmoke failed in 100ms,file=bin/host/ffmpeg/BUILD.bazel:://bin/host/ffmpeg:smoke FAILED%0Anope%0A\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func writeEvent(t *testing.T, w *bytes.Buffer, event *bep.BuildEvent) {
	t.Helper()
	if _, err := protodelim.MarshalTo(w, event); err != nil {
		t.Fatal(err)
	}
}
