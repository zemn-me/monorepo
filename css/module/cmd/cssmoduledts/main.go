package main

import (
	"bytes"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strconv"
)

var classPattern = regexp.MustCompile(`\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)`)

func declaration(css []byte) []byte {
	matches := classPattern.FindAllSubmatch(css, -1)
	classes := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		classes[string(match[1])] = struct{}{}
	}

	names := make([]string, 0, len(classes))
	for name := range classes {
		names = append(names, name)
	}
	sort.Strings(names)

	var out bytes.Buffer
	out.WriteString("declare const styles: {\n")
	out.WriteString("\treadonly [key: string]: string;\n")
	for _, name := range names {
		fmt.Fprintf(&out, "\treadonly %s: string;\n", strconv.Quote(name))
	}
	out.WriteString("};\n")
	out.WriteString("export default styles;\n")
	return out.Bytes()
}

func run(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("usage: cssmoduledts <input.css> <output.d.ts>")
	}

	css, err := os.ReadFile(args[0])
	if err != nil {
		return fmt.Errorf("read %s: %w", args[0], err)
	}

	if err := os.WriteFile(args[1], declaration(css), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", args[1], err)
	}

	return nil
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
