package ts

import (
	"path"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/rule"
	bzl "github.com/bazelbuild/buildtools/build"
)

const testMainDepKey = "typescript:test_main_dep"

type testRuleConfig struct {
	mainName   string
	srcs       []string
	deps       depSet
	needsJsdom bool
}

func (cfg testRuleConfig) hasTests() bool {
	return len(cfg.srcs) > 0
}

func (cfg testRuleConfig) buildRules(args language.GenerateArgs, gen *[]*rule.Rule, imports *[]interface{}) {
	if !cfg.hasTests() {
		return
	}

	testProjectName := cfg.mainName + "_tests"
	var testJS []string
	for _, tf := range cfg.srcs {
		testJS = append(testJS, strings.TrimSuffix(tf, path.Ext(tf))+".js")
	}

	existingJest := findRuleByKind(args, "tests", "jest_test")

	j := rule.NewRule("jest_test", "tests")
	if existingJest != nil {
		if vis := existingJest.AttrStrings("visibility"); len(vis) > 0 {
			j.SetAttr("visibility", vis)
		}
		if attr := existingJest.Attr("srcs"); attr != nil {
			if preserved, ok := shouldPreserveSrcs(attr); ok {
				j.SetAttr("srcs", preserved)
			} else if call, ok := attr.(*bzl.CallExpr); ok {
				if lit, ok := call.X.(*bzl.LiteralExpr); ok && lit.Token == "glob" {
					// preserve existing glob
				} else {
					j.SetAttr("srcs", testJS)
				}
			} else {
				j.SetAttr("srcs", testJS)
			}
		} else {
			j.SetAttr("srcs", testJS)
		}
	} else {
		j.SetAttr("visibility", []string{"//:__subpackages__"})
		j.SetAttr("srcs", testJS)
	}
	j.SetAttr("deps", []string{":" + testProjectName})
	if cfg.needsJsdom {
		j.SetAttr("jsdom", true)
	}
	*gen = append(*gen, j)
	*imports = append(*imports, nil)
}
