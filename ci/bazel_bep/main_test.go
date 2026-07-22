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

func TestPassedTestIsSilent(t *testing.T) {
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

	var out bytes.Buffer
	if err := annotateBEP(&stream, &out, t.TempDir()); err != nil {
		t.Fatal(err)
	}

	if out.String() != "" {
		t.Fatalf("expected no annotations for passed test, got:\n%s", out.String())
	}
}

func TestFailedTargetUsesBuildFile(t *testing.T) {
	var stream bytes.Buffer
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
	if err := annotateBEP(&stream, &out, t.TempDir()); err != nil {
		t.Fatal(err)
	}

	const expected = "::error title=//.github/workflows%3Avalidation failed to build,file=.github/workflows/BUILD.bazel:://.github/workflows:validation failed to build\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestFailedTestAnnotatesSourceFilesMentionedInLogs(t *testing.T) {
	workspace := t.TempDir()
	source := filepath.Join(workspace, "ts", "pulumi", "index.ts")
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("broken();\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	log := filepath.Join(t.TempDir(), "test.log")
	if err := os.WriteFile(log, []byte("Error: ts/pulumi/index.ts:7:11 no thanks\nbazel-out/generated.ts:1:1 ignored\n"), 0o600); err != nil {
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
	if err := annotateBEP(&stream, &out, workspace); err != nil {
		t.Fatal(err)
	}

	const expected = "" +
		"::error title=//bin/host/ffmpeg%3Asmoke failed in 100ms,file=bin/host/ffmpeg/BUILD.bazel:://bin/host/ffmpeg:smoke FAILED%0AError: ts/pulumi/index.ts:7:11 no thanks%0Abazel-out/generated.ts:1:1 ignored%0A\n" +
		"::error title=//bin/host/ffmpeg%3Asmoke failed in 100ms,file=ts/pulumi/index.ts,line=7,col=11:://bin/host/ffmpeg:smoke FAILED%0AError: ts/pulumi/index.ts:7:11 no thanks%0Abazel-out/generated.ts:1:1 ignored%0A\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestAnnotateBuildBuddyLinks(t *testing.T) {
	summary := filepath.Join(t.TempDir(), "summary.md")
	t.Setenv("GITHUB_STEP_SUMMARY", summary)

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
	if err := annotateBEP(&stream, &out, t.TempDir()); err != nil {
		t.Fatal(err)
	}

	const expected = "" +
		"::notice title=BuildBuddy invocation::[Open BuildBuddy invocation](https://app.buildbuddy.io/invocation/abc123)\n" +
		"::notice title=BuildBuddy invocation::[Open BuildBuddy invocation](https://app.buildbuddy.io/invocation/def456)\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}

	summaryContent, err := os.ReadFile(summary)
	if err != nil {
		t.Fatal(err)
	}

	const expectedSummary = "" +
		"### BuildBuddy\n\n" +
		"- [Open BuildBuddy invocation](https://app.buildbuddy.io/invocation/abc123)\n" +
		"- [Open BuildBuddy invocation](https://app.buildbuddy.io/invocation/def456)\n\n"
	if string(summaryContent) != expectedSummary {
		t.Fatalf("unexpected summary:\n%s", string(summaryContent))
	}
}

func writeEvent(t *testing.T, w *bytes.Buffer, event *bep.BuildEvent) {
	t.Helper()
	if _, err := protodelim.MarshalTo(w, event); err != nil {
		t.Fatal(err)
	}
}
