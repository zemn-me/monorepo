package jsonc

import (
	"bytes"
	"io"
	"strings"
	"testing"

	diff "github.com/sourcegraph/go-diff-patch"
)

const test_json = `{
	"$schema": "https://json.schemastore.org/tsconfig",
	"compilerOptions": {
		"module": "preserve",
		"moduleResolution": "bundler",
		"target": "es2020",
		"strictFunctionTypes": true,
		"esModuleInterop": true,
		"strict": true,
		"jsx": "react-jsx",
		"resolveJsonModule": true,
		"noUncheckedIndexedAccess": true,
		"noFallthroughCasesInSwitch": true,
		"noImplicitAny": true,
		"noImplicitThis": true,
		"declaration": true,
		"noImplicitOverride": true,
		"forceConsistentCasingInFileNames": true,
		"downlevelIteration": true,
		"allowJs": true,
		"declarationMap": true,
		"lib": [
			"DOM",
			"ESNext"
		],
		"baseUrl": ".",
		"paths": {
			"#root/*": [
				"*",
				"dist/bin/*"
			],
		}
	},
	"exclude": [
		"node_modules",
		"dist",
		"external"
	]
}
`

func TestCommentStripper(t *testing.T) {
	var b bytes.Buffer
	_, err := io.Copy(&b, newCommentStripper(strings.NewReader(test_json)))
	if err != nil {
		t.Fatal(err)
	}

	s := b.String()

	if s != test_json {
		t.Fatal(
			diff.GeneratePatch(
				"test_json",
				s,
				test_json,
			),
		)
	}
}

func TestParseExampleTSConfig(t *testing.T) {
	var Q interface{}

	err := NewDecoder(strings.NewReader(test_json)).Decode(&Q)
	if err != nil {
		t.Fatal(err)
	}
}
