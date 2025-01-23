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

// Do reads versions from go.mod and MODULE.bazel, compares them, and updates
// one or both if needed (when -fix is specified). If output paths are given,
// writes the *complete edited file* to those paths.
func Do() error {
	// 1. Read the current versions
	goModVersion, err := readGoModVersion(goModPath)
	if err != nil {
		return fmt.Errorf("failed to read go.mod: %w", err)
	}
	bazelGoVersion, err := readBazelGoVersion(bazelPath)
	if err != nil {
		return fmt.Errorf("failed to read MODULE.bazel: %w", err)
	}

	// 2. Determine the latest version via semver comparison
	latest, err := getLatestVersion(goModVersion, bazelGoVersion)
	if err != nil {
		return fmt.Errorf("failed to determine latest version: %w", err)
	}

	// 3. If we're not fixing, just check consistency
	if !fixDiscrepancy {
		if goModVersion != bazelGoVersion {
			return fmt.Errorf("versions are inconsistent; run with -fix to synchronise")
		}
		return nil
	}

	// 4. If we are fixing, update go.mod if needed
	if goModVersion != latest {
		fmt.Printf("Updating go.mod from %s to %s\n", goModVersion, latest)
		if err := rewriteGoMod(goModPath, outputGoMod, latest); err != nil {
			return fmt.Errorf("failed to update go.mod: %w", err)
		}
	} else {
		// If it doesn't need updating but an output path is set, still copy over
		if outputGoMod != "" {
			if err := copyFile(goModPath, outputGoMod); err != nil {
				return fmt.Errorf("failed to copy go.mod to output: %w", err)
			}
		}
	}

	// 5. Update MODULE.bazel if needed
	if bazelGoVersion != latest {
		fmt.Printf("Updating MODULE.bazel from %s to %s\n", bazelGoVersion, latest)
		if err := rewriteBazelGoVersion(bazelPath, outputBazel, latest); err != nil {
			return fmt.Errorf("failed to update MODULE.bazel: %w", err)
		}
	} else {
		// If it doesn't need updating but an output path is set, still copy over
		if outputBazel != "" {
			if err := copyFile(bazelPath, outputBazel); err != nil {
				return fmt.Errorf("failed to copy MODULE.bazel to output: %w", err)
			}
		}
	}

	return nil
}

// getLatestVersion compares two semver strings and returns the higher version.
func getLatestVersion(v1, v2 string) (string, error) {
	semver1, err := semver.ParseTolerant(v1)
	if err != nil {
		return "", fmt.Errorf("invalid version in go.mod: %w", err)
	}
	semver2, err := semver.ParseTolerant(v2)
	if err != nil {
		return "", fmt.Errorf("invalid version in MODULE.bazel: %w", err)
	}
	if semver1.GT(semver2) {
		return semver1.String(), nil
	}
	return semver2.String(), nil
}

// readGoModVersion scans go.mod for a line matching `go <version>`
func readGoModVersion(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("unable to open file %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`^go\s+(\S+)$`)
	for scanner.Scan() {
		line := scanner.Text()
		if matches := re.FindStringSubmatch(line); len(matches) == 2 {
			return matches[1], nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error reading file %s: %w", path, err)
	}
	return "", fmt.Errorf("no go version found in %s", path)
}

// rewriteGoMod reads go.mod, updates its `go <version>` line to newVersion (if needed),
// and writes the full updated content either to outputPath (if not empty) or back to srcPath.
func rewriteGoMod(srcPath, outputPath, newVersion string) error {
	contents, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("unable to read file %s: %w", srcPath, err)
	}
	lines := strings.Split(string(contents), "\n")

	re := regexp.MustCompile(`^go\s+(\S+)$`)
	for i, line := range lines {
		if re.MatchString(line) {
			lines[i] = "go " + newVersion
			break
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

// readBazelGoVersion scans MODULE.bazel for a line matching `GO_VERSION = "<version>"`
func readBazelGoVersion(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("unable to open file %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`^(\s*)GO_VERSION\s*=\s*"([^"]+)"`)
	for scanner.Scan() {
		line := scanner.Text()
		if matches := re.FindStringSubmatch(line); len(matches) == 3 {
			return matches[2], nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error reading file %s: %w", path, err)
	}
	return "", fmt.Errorf("no GO_VERSION found in %s", path)
}

// rewriteBazelGoVersion reads MODULE.bazel, updates its `GO_VERSION = "<version>"` to newVersion,
// and writes the full updated content either to outputPath (if provided) or back to srcPath.
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

// copyFile simply copies the entire content from src to dst unmodified.
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return err
	}
	return nil
}
