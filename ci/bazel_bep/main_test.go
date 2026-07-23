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
	workspace := t.TempDir()
	buildFile := filepath.Join(workspace, ".github", "workflows", "BUILD.bazel")
	if err := os.MkdirAll(filepath.Dir(buildFile), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(buildFile, []byte(`# build
load("//bzl:rules.bzl", "bazel_lint")

bazel_lint(
    name = "validation",
    srcs = ["presubmit.yml"],
)
`), 0o600); err != nil {
		t.Fatal(err)
	}

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
	if err := annotateBEP(&stream, &out, workspace); err != nil {
		t.Fatal(err)
	}

	const expected = "::error title=//.github/workflows%3Avalidation failed to build,file=.github/workflows/BUILD.bazel,line=4:://.github/workflows:validation failed to build\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestFailedTargetDoesNotLinkMissingBuildFile(t *testing.T) {
	var stream bytes.Buffer
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_TargetCompleted{
				TargetCompleted: &bep.BuildEventId_TargetCompletedId{
					Label: "//missing:target",
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

	const expected = "::error title=//missing%3Atarget failed to build:://missing:target failed to build\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestFailedTestAnnotatesSourceFilesMentionedInLogs(t *testing.T) {
	workspace := t.TempDir()
	buildFile := filepath.Join(workspace, "bin", "host", "ffmpeg", "BUILD.bazel")
	if err := os.MkdirAll(filepath.Dir(buildFile), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(buildFile, []byte("# build\n"), 0o600); err != nil {
		t.Fatal(err)
	}
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
		"::error title=//bin/host/ffmpeg%3Asmoke failed in 100ms,file=bin/host/ffmpeg/BUILD.bazel,line=1:://bin/host/ffmpeg:smoke FAILED%0AError: ts/pulumi/index.ts:7:11 no thanks%0Abazel-out/generated.ts:1:1 ignored%0A\n" +
		"::error title=//bin/host/ffmpeg%3Asmoke failed in 100ms,file=ts/pulumi/index.ts,line=7,col=11:://bin/host/ffmpeg:smoke FAILED%0AError: ts/pulumi/index.ts:7:11 no thanks%0Abazel-out/generated.ts:1:1 ignored%0A\n"
	if out.String() != expected {
		t.Fatalf("unexpected annotations:\n%s", out.String())
	}
}

func TestProgressAnnotatesRebasedRepositoryFiles(t *testing.T) {
	workspace := t.TempDir()
	source := filepath.Join(workspace, "ts", "pulumi", "index.ts")
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("broken();\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stream bytes.Buffer
	writeEvent(t, &stream, &bep.BuildEvent{
		Id: &bep.BuildEventId{
			Id: &bep.BuildEventId_Progress{
				Progress: &bep.BuildEventId_ProgressId{},
			},
		},
		Payload: &bep.BuildEvent_Progress{
			Progress: &bep.Progress{
				Stderr: "" +
					"ERROR: /home/runner/.cache/bazel/_bazel_runner/hash/execroot/_main/ts/pulumi/index.ts:7:11 no thanks\n" +
					"DEBUG: bazel-out/k8-fastbuild/bin/tool.runfiles/_main/ts/pulumi/index.ts:3:2 details\n" +
					"WARNING: /home/runner/.cache/bazel/_bazel_runner/hash/execroot/_main/external/tool/missing.bzl:9:1 ignored\n" +
					"INFO: ts/pulumi/index.ts:1:1 is not an annotation",
			},
		},
	})

	var out bytes.Buffer
	if err := annotateBEP(&stream, &out, workspace); err != nil {
		t.Fatal(err)
	}

	const expected = "" +
		"::error title=Bazel error,file=ts/pulumi/index.ts,line=7,col=11::ERROR: /home/runner/.cache/bazel/_bazel_runner/hash/execroot/_main/ts/pulumi/index.ts:7:11 no thanks\n" +
		"::debug title=Bazel debug,file=ts/pulumi/index.ts,line=3,col=2::DEBUG: bazel-out/k8-fastbuild/bin/tool.runfiles/_main/ts/pulumi/index.ts:3:2 details\n"
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
