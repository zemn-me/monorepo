package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/blang/semver/v4"
)

var (
	goModPath      string
	bazelPath      string
	fixDiscrepancy bool
	outputGoMod    string
	outputBazel    string
)

func init() {
	flag.StringVar(&goModPath, "go-mod", "go.mod", "Path to the go.mod file")
	flag.StringVar(&bazelPath, "module-bazel", "MODULE.bazel", "Path to the MODULE.bazel file")
	flag.StringVar(&outputGoMod, "output-go-mod", "", "Path to output the updated go.mod")
	flag.StringVar(&outputBazel, "output-module-bazel", "", "Path to output the updated MODULE.bazel")
	flag.BoolVar(&fixDiscrepancy, "fix", false, "Fix discrepancies instead of just reporting errors")
}

func main() {
	flag.Parse()
	if err := Do(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// Do orchestrates reading versions from go.mod and MODULE.bazel, compares them,
// and updates where needed if -fix is set.
func Do() error {
	// 1. Read versions from go.mod (both 'go' and 'toolchain go')
	goModVersion, toolchainVersion, err := readGoModVersions(goModPath)
	if err != nil {
		return fmt.Errorf("failed to read go.mod: %w", err)
	}

	// 2. Read version from MODULE.bazel
	bazelGoVersion, err := readBazelGoVersion(bazelPath)
	if err != nil {
		return fmt.Errorf("failed to read MODULE.bazel: %w", err)
	}

	// 3. Determine the highest version amongst what's found
	latest, err := getLatestVersionOfAll([]string{goModVersion, bazelGoVersion, toolchainVersion})
	if err != nil {
		return fmt.Errorf("failed to compute latest version: %w", err)
	}

	// If we're just checking consistency, fail if there's a mismatch
	if !fixDiscrepancy {
		// If any two differ, we consider that inconsistent
		if (goModVersion != "" && goModVersion != latest) ||
			(toolchainVersion != "" && toolchainVersion != latest) ||
			bazelGoVersion != latest {
			return fmt.Errorf("versions are inconsistent; run with -fix to synchronise to %s", latest)
		}
		return nil
	}

	// 4. Fix go.mod lines if needed. We only rewrite when the existing
	// version lines are present and differ from the desired version.
	changeGoVersion := goModVersion != "" && goModVersion != latest
	changeToolchain := toolchainVersion != "" && toolchainVersion != latest
	if changeGoVersion || changeToolchain {
		if err := rewriteGoMod(goModPath, outputGoMod, latest); err != nil {
			return fmt.Errorf("failed to update go.mod: %w", err)
		}
	} else if outputGoMod != "" {
		// If no change but user wants a separate output file, just copy
		if err := copyFile(goModPath, outputGoMod); err != nil {
			return fmt.Errorf("failed to copy go.mod to output: %w", err)
		}
	}

	// 5. Fix MODULE.bazel if needed
	if bazelGoVersion != latest {
		if err := rewriteBazelGoVersion(bazelPath, outputBazel, latest); err != nil {
			return fmt.Errorf("failed to update MODULE.bazel: %w", err)
		}
	} else if outputBazel != "" {
		if err := copyFile(bazelPath, outputBazel); err != nil {
			return fmt.Errorf("failed to copy MODULE.bazel to output: %w", err)
		}
	}

	return nil
}

// readGoModVersions returns two strings: (goVersion, toolchainGoVersion).
// If a line "go X" is found, that becomes goVersion.
// If a line "toolchain go Y" is found, that becomes toolchainGoVersion.
func readGoModVersions(path string) (string, string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", "", fmt.Errorf("unable to open file %s: %w", path, err)
	}
	defer file.Close()

	var (
		goVersion          string
		toolchainGoVersion string
	)

	scanner := bufio.NewScanner(file)
	reGo := regexp.MustCompile(`^go\s+(\S+)$`)
	reToolchain := regexp.MustCompile(`^toolchain\s+go\s+(\S+)$`)

	for scanner.Scan() {
		line := scanner.Text()
		if matches := reGo.FindStringSubmatch(line); len(matches) == 2 {
			goVersion = matches[1]
		} else if matches := reToolchain.FindStringSubmatch(line); len(matches) == 2 {
			toolchainGoVersion = matches[1]
		}
	}

	if err := scanner.Err(); err != nil {
		return "", "", fmt.Errorf("error reading file %s: %w", path, err)
	}

	// It's possible none or only one of them was found.
	// We'll allow empty returns to indicate "not found".
	return goVersion, toolchainGoVersion, nil
}

// rewriteGoMod updates both `go <version>` and `toolchain go <version>` lines (if present).
func rewriteGoMod(srcPath, outputPath, newVersion string) error {
	contents, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("unable to read file %s: %w", srcPath, err)
	}
	lines := strings.Split(string(contents), "\n")

	reGo := regexp.MustCompile(`^go\s+(\S+)$`)
	reToolchain := regexp.MustCompile(`^toolchain\s+go\s+(\S+)$`)

	for i, line := range lines {
		switch {
		case reGo.MatchString(line):
			lines[i] = "go " + newVersion
		case reToolchain.MatchString(line):
			lines[i] = "toolchain go " + newVersion
		}
	}

	destPath := srcPath
	if outputPath != "" {
		destPath = outputPath
	}
	if err := os.WriteFile(destPath, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return fmt.Errorf("unable to write updated go.mod to %s: %w", destPath, err)
	}
	return nil
}

// readBazelGoVersion scans MODULE.bazel for a line matching `GO_VERSION = "<version>"`.
func readBazelGoVersion(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("unable to open file %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`^\s*GO_VERSION\s*=\s*"([^"]+)"`)

	for scanner.Scan() {
		line := scanner.Text()
		if matches := re.FindStringSubmatch(line); len(matches) == 2 {
			return matches[1], nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error reading file %s: %w", path, err)
	}
	return "", fmt.Errorf("no GO_VERSION found in %s", path)
}

// rewriteBazelGoVersion reads MODULE.bazel, updates `GO_VERSION = "<version>"`.
func rewriteBazelGoVersion(srcPath, outputPath, newVersion string) error {
	contents, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("unable to read file %s: %w", srcPath, err)
	}
	lines := strings.Split(string(contents), "\n")

	re := regexp.MustCompile(`^(\s*)GO_VERSION\s*=\s*"([^"]+)"`)
	for i, line := range lines {
		if matches := re.FindStringSubmatch(line); len(matches) == 3 {
			prefix := matches[1]
			lines[i] = fmt.Sprintf(`%sGO_VERSION = "%s"`, prefix, newVersion)
			break
		}
	}

	destPath := srcPath
	if outputPath != "" {
		destPath = outputPath
	}
	if err := os.WriteFile(destPath, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return fmt.Errorf("unable to write updated MODULE.bazel to %s: %w", destPath, err)
	}
	return nil
}

// copyFile copies contents from src to dst unmodified.
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

// getLatestVersionOfAll finds the highest semver among a list of versions (some may be empty).
func getLatestVersionOfAll(versions []string) (string, error) {
	var maxVer *semver.Version
	for _, v := range versions {
		if v == "" {
			continue
		}
		parsed, err := semver.ParseTolerant(v)
		if err != nil {
			return "", fmt.Errorf("invalid semver version: %s (%w)", v, err)
		}
		if maxVer == nil || parsed.GT(*maxVer) {
			maxVer = &parsed
		}
	}
	if maxVer == nil {
		return "", fmt.Errorf("no valid version discovered")
	}
	return maxVer.String(), nil
}

// safeStr helps printing empty-version placeholders gracefully.
func safeStr(s string) string {
	if s == "" {
		return "N/A"
	}
	return s
}
