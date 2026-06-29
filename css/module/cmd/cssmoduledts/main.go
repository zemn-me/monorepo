package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"

	"github.com/tdewolff/parse/v2"
	"github.com/tdewolff/parse/v2/css"
)

func classNames(data []byte) ([]string, error) {
	parser := css.NewParser(parse.NewInputBytes(data), false)
	classes := make(map[string]struct{})

	for {
		grammar, _, _ := parser.Next()
		if grammar == css.ErrorGrammar {
			if err := parser.Err(); err != io.EOF {
				return nil, err
			}
			break
		}
		if grammar != css.BeginRulesetGrammar {
			continue
		}

		collectSelectorClasses(parser.Values(), classes)
	}

	names := make([]string, 0, len(classes))
	for name := range classes {
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

func collectSelectorClasses(tokens []css.Token, classes map[string]struct{}) {
	globalDepth := 0
	var functionStack []bool

	for i := 0; i < len(tokens); i++ {
		token := tokens[i]
		switch token.TokenType {
		case css.FunctionToken:
			isGlobal := bytes.Equal(token.Data, []byte("global("))
			functionStack = append(functionStack, isGlobal)
			if isGlobal {
				globalDepth++
			}
		case css.RightParenthesisToken:
			if len(functionStack) == 0 {
				continue
			}
			last := len(functionStack) - 1
			if functionStack[last] {
				globalDepth--
			}
			functionStack = functionStack[:last]
		case css.DelimToken:
			if !bytes.Equal(token.Data, []byte(".")) || globalDepth > 0 || i+1 >= len(tokens) {
				continue
			}
			next := tokens[i+1]
			if next.TokenType == css.IdentToken {
				classes[string(next.Data)] = struct{}{}
			}
		}
	}
}

func declaration(data []byte) ([]byte, error) {
	names, err := classNames(data)
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	out.WriteString("declare const styles: {\n")
	out.WriteString("\treadonly [key: string]: string;\n")
	for _, name := range names {
		fmt.Fprintf(&out, "\treadonly %s: string;\n", strconv.Quote(name))
	}
	out.WriteString("};\n")
	out.WriteString("export default styles;\n")
	return out.Bytes(), nil
}

func run(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("usage: cssmoduledts <input.css> <output.d.ts>")
	}

	css, err := os.ReadFile(args[0])
	if err != nil {
		return fmt.Errorf("read %s: %w", args[0], err)
	}

	types, err := declaration(css)
	if err != nil {
		return fmt.Errorf("parse %s: %w", args[0], err)
	}

	if err := os.WriteFile(args[1], types, 0o644); err != nil {
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
