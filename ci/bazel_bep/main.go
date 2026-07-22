package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	bep "github.com/zemn-me/monorepo/ci/bazel_bep/build_event_stream_proto"
	"google.golang.org/protobuf/encoding/protodelim"
	"google.golang.org/protobuf/types/known/durationpb"
)

var (
	buildBuddyURL = regexp.MustCompile(`https://[^\s"'<>]*buildbuddy[^\s"'<>]*`)
	pathMention   = regexp.MustCompile(`(?:^|[\s"'(])((?:[A-Za-z]:)?/?[A-Za-z0-9._+@%=-][A-Za-z0-9._+@%=/,:-]*\.[A-Za-z0-9_+-]+)(?::(\d+))?(?::(\d+))?`)
)

type annotator struct {
	buildBuddyLinks []string
	seen            map[string]bool
	seenSummaryLink map[string]bool
	summaryPath     string
	workspace       string
}

type params map[string]string

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

	workspace, err := os.Getwd()
	if err != nil {
		return err
	}

	return annotateBEP(f, out, workspace)
}

func annotateBEP(in io.Reader, out io.Writer, workspace string) error {
	r := bufio.NewReader(in)
	a := annotator{
		seen:            map[string]bool{},
		seenSummaryLink: map[string]bool{},
		summaryPath:     os.Getenv("GITHUB_STEP_SUMMARY"),
		workspace:       workspace,
	}

	for {
		event := &bep.BuildEvent{}
		err := protodelim.UnmarshalOptions{MaxSize: -1}.UnmarshalFrom(r, event)
		if errors.Is(err, io.EOF) {
			return a.writeBuildBuddySummary()
		}
		if err != nil {
			return err
		}

		for _, annotation := range a.annotations(event) {
			if a.seen[annotation] {
				continue
			}
			a.seen[annotation] = true
			fmt.Fprintln(out, annotation)
		}
	}
}

func (a *annotator) annotations(event *bep.BuildEvent) []string {
	var out []string

	out = append(out, a.buildBuddyAnnotations(event)...)

	if id := event.GetId(); id != nil {
		if target := id.GetTargetCompleted(); target != nil && event.GetCompleted() != nil && !event.GetCompleted().GetSuccess() {
			label := target.GetLabel()
			body := label + " failed to build"
			out = append(out, command("error", params{
				"file":  buildFileForLabel(label),
				"title": body,
			}, body))
		}

		if summaryID := id.GetTestSummary(); summaryID != nil && event.GetTestSummary() != nil {
			out = append(out, a.testSummaryAnnotations(summaryID.GetLabel(), event.GetTestSummary())...)
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

func (a *annotator) buildBuddyAnnotations(event *bep.BuildEvent) []string {
	var out []string

	if progress := event.GetProgress(); progress != nil {
		for _, text := range []string{progress.GetStdout(), progress.GetStderr()} {
			for _, match := range buildBuddyURL.FindAllString(text, -1) {
				a.recordBuildBuddyLink(match)
				out = append(out, command("notice", params{"title": "BuildBuddy invocation"}, buildBuddyLink(match)))
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
				a.recordBuildBuddyLink(match)
				out = append(out, command("notice", params{"title": title}, buildBuddyLink(match)))
			}

			if log.GetContents() == nil {
				continue
			}

			for _, match := range buildBuddyURL.FindAllString(string(log.GetContents()), -1) {
				a.recordBuildBuddyLink(match)
				out = append(out, command("notice", params{"title": title}, buildBuddyLink(match)))
			}
		}
	}

	return out
}

func (a *annotator) recordBuildBuddyLink(match string) {
	if a.seenSummaryLink[match] {
		return
	}
	a.seenSummaryLink[match] = true
	a.buildBuddyLinks = append(a.buildBuddyLinks, match)
}

func (a annotator) writeBuildBuddySummary() error {
	if a.summaryPath == "" || len(a.buildBuddyLinks) == 0 {
		return nil
	}

	var b strings.Builder
	b.WriteString("### BuildBuddy\n\n")
	for _, link := range a.buildBuddyLinks {
		b.WriteString("- ")
		b.WriteString(buildBuddyLink(link))
		b.WriteByte('\n')
	}
	b.WriteByte('\n')

	f, err := os.OpenFile(a.summaryPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(b.String())
	return err
}

func buildBuddyLink(match string) string {
	return "[Open BuildBuddy invocation](" + match + ")"
}

func (a annotator) testSummaryAnnotations(label string, summary *bep.TestSummary) []string {
	status := summary.GetOverallStatus()
	if status == bep.TestStatus_PASSED {
		return nil
	}

	level := "error"
	if status == bep.TestStatus_FLAKY || status == bep.TestStatus_NO_STATUS {
		level = "warning"
	}

	logText := failedLogs(summary.GetFailed())
	body := label + " " + status.String() + logText
	title := label + " " + strings.ToLower(status.String()) + durationSuffix(summary.GetTotalRunDuration())
	fallbackFile := buildFileForLabel(label)

	out := []string{
		command(level, params{
			"file":  fallbackFile,
			"title": title,
		}, body),
	}

	for _, location := range a.sourceLocations(logText) {
		out = append(out, command(level, params{
			"col":   location.col,
			"file":  location.file,
			"line":  location.line,
			"title": title,
		}, body))
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

type sourceLocation struct {
	file string
	line string
	col  string
}

func (a annotator) sourceLocations(text string) []sourceLocation {
	var locations []sourceLocation
	seen := map[string]bool{}

	for _, match := range pathMention.FindAllStringSubmatch(text, -1) {
		file, ok := a.workspaceRelativeFile(match[1])
		if !ok {
			continue
		}
		location := sourceLocation{
			file: file,
			line: match[2],
			col:  match[3],
		}
		key := location.file + ":" + location.line + ":" + location.col
		if seen[key] {
			continue
		}
		seen[key] = true
		locations = append(locations, location)
	}

	return locations
}

func (a annotator) workspaceRelativeFile(candidate string) (string, bool) {
	candidate = strings.Trim(candidate, ".,;")
	if candidate == "" || strings.Contains(candidate, "://") {
		return "", false
	}

	var abs string
	if filepath.IsAbs(candidate) {
		abs = filepath.Clean(candidate)
	} else {
		abs = filepath.Join(a.workspace, filepath.Clean(candidate))
	}

	rel, err := filepath.Rel(a.workspace, abs)
	if err != nil || rel == "." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || rel == ".." || filepath.IsAbs(rel) {
		return "", false
	}

	info, err := os.Stat(abs)
	if err != nil || info.IsDir() {
		return "", false
	}

	return filepath.ToSlash(rel), true
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
