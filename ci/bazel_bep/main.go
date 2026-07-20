package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	bep "github.com/zemn-me/monorepo/ci/bazel_bep/build_event_stream_proto"
	"google.golang.org/protobuf/encoding/protodelim"
	"google.golang.org/protobuf/types/known/durationpb"
)

var buildBuddyURL = regexp.MustCompile(`https://[^\s"'<>]*buildbuddy[^\s"'<>]*`)

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("bep_annotator", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	if err := flags.Parse(args); err != nil {
		return err
	}

	if flags.NArg() != 1 {
		return fmt.Errorf("usage: bep_annotator <build-event-binary-file>")
	}

	f, err := os.Open(flags.Arg(0))
	if err != nil {
		return err
	}
	defer f.Close()

	return annotateBEP(f, out)
}

func annotateBEP(in io.Reader, out io.Writer) error {
	r := bufio.NewReader(in)
	seen := map[string]bool{}

	for {
		event := &bep.BuildEvent{}
		err := protodelim.UnmarshalOptions{MaxSize: -1}.UnmarshalFrom(r, event)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}

		for _, annotation := range annotations(event) {
			if seen[annotation] {
				continue
			}
			seen[annotation] = true
			fmt.Fprintln(out, annotation)
		}
	}
}

func annotations(event *bep.BuildEvent) []string {
	var out []string

	if progress := event.GetProgress(); progress != nil {
		for _, text := range []string{progress.GetStdout(), progress.GetStderr()} {
			for _, match := range buildBuddyURL.FindAllString(text, -1) {
				out = append(out, command("notice", params{"title": "BuildBuddy invocation"}, match))
			}
		}
	}

	if logs := event.GetBuildToolLogs(); logs != nil {
		for _, log := range logs.GetLog() {
			title := log.GetName()
			if title == "" {
				title = "BuildBuddy invocation"
			}

			for _, match := range buildBuddyURL.FindAllString(log.GetUri(), -1) {
				out = append(out, command("notice", params{"title": title}, match))
			}

			if log.GetContents() == nil {
				continue
			}

			for _, match := range buildBuddyURL.FindAllString(string(log.GetContents()), -1) {
				out = append(out, command("notice", params{"title": title}, match))
			}
		}
	}

	if id := event.GetId(); id != nil {
		if target := id.GetTargetCompleted(); target != nil && event.GetCompleted() != nil && !event.GetCompleted().GetSuccess() {
			label := target.GetLabel()
			out = append(out, command("error", params{
				"file":  buildFileForLabel(label),
				"title": label + " failed to build",
			}, label+" failed to build"))
		}

		if summaryID := id.GetTestSummary(); summaryID != nil && event.GetTestSummary() != nil {
			label := summaryID.GetLabel()
			summary := event.GetTestSummary()
			status := summary.GetOverallStatus()
			level := "error"
			if status == bep.TestStatus_PASSED {
				level = "notice"
			} else if status == bep.TestStatus_FLAKY || status == bep.TestStatus_NO_STATUS {
				level = "warning"
			}

			body := label + " " + status.String() + failedLogs(summary.GetFailed())
			out = append(out, command(level, params{
				"file":  buildFileForLabel(label),
				"title": label + " " + strings.ToLower(status.String()) + durationSuffix(summary.GetTotalRunDuration()),
			}, body))
		}

		if event.GetAborted() != nil {
			aborted := event.GetAborted()
			title := aborted.GetReason().String()
			if title == "" {
				title = "Bazel event aborted"
			}
			body := aborted.GetDescription()
			if body == "" {
				body = "Bazel event aborted"
			}
			out = append(out, command("error", params{"title": title}, body))
		}

		if id.GetBuildFinished() != nil && event.GetFinished() != nil {
			finished := event.GetFinished()
			exitCode := finished.GetExitCode()
			if exitCode != nil && exitCode.GetCode() != 0 {
				out = append(out, command("error", params{
					"title": "Bazel " + strings.ToLower(exitCode.GetName()),
				}, "Bazel finished with "+exitCode.GetName()))
			}
		}
	}

	return out
}

func failedLogs(files []*bep.File) string {
	var chunks []string

	for _, file := range files {
		if file.GetUri() == "" {
			continue
		}
		path, ok := filePathFromURI(file.GetUri())
		if !ok {
			continue
		}

		content, err := os.ReadFile(path)
		if err != nil {
			chunks = append(chunks, "Unable to read "+file.GetUri())
			continue
		}
		chunks = append(chunks, string(content))
	}

	if len(chunks) == 0 {
		return ""
	}

	return "\n" + strings.Join(chunks, "\n")
}

func filePathFromURI(uri string) (string, bool) {
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "file" {
		return "", false
	}

	return u.Path, true
}

func buildFileForLabel(label string) string {
	if !strings.HasPrefix(label, "//") {
		return ""
	}

	label = strings.TrimPrefix(label, "//")
	pkg, _, _ := strings.Cut(label, ":")
	if pkg == "" {
		return "BUILD.bazel"
	}

	return pkg + "/BUILD.bazel"
}

func durationSuffix(d *durationpb.Duration) string {
	if d == nil {
		return ""
	}

	duration := d.AsDuration()
	if duration == 0 {
		return ""
	}

	return " in " + duration.Round(time.Millisecond).String()
}

type params map[string]string

func command(name string, p params, message string) string {
	var b strings.Builder
	b.WriteString("::")
	b.WriteString(name)

	if len(p) > 0 {
		first := true
		for _, key := range []string{"title", "file", "line", "col"} {
			value, ok := p[key]
			if !ok || value == "" {
				continue
			}
			if first {
				b.WriteByte(' ')
				first = false
			} else {
				b.WriteByte(',')
			}
			b.WriteString(key)
			b.WriteByte('=')
			b.WriteString(escapeProperty(value))
		}
	}

	b.WriteString("::")
	b.WriteString(escapeData(message))

	return b.String()
}

func escapeProperty(value string) string {
	value = escapeData(value)
	value = strings.ReplaceAll(value, ":", "%3A")
	value = strings.ReplaceAll(value, ",", "%2C")
	return value
}

func escapeData(value string) string {
	value = strings.ReplaceAll(value, "%", "%25")
	value = strings.ReplaceAll(value, "\r", "%0D")
	value = strings.ReplaceAll(value, "\n", "%0A")
	return value
}
