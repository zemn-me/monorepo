package ts

import (
	"path"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/rule"
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

	var testJS []string
	for _, tf := range cfg.srcs {
		testJS = append(testJS, strings.TrimSuffix(tf, path.Ext(tf))+".js")
	}

	testProjectName := cfg.mainName + "_tests"
	j := rule.NewRule("jest_test", "tests")
	j.SetAttr("srcs", testJS)
	j.SetAttr("deps", []string{":" + testProjectName})
	if cfg.needsJsdom {
		j.SetAttr("jsdom", true)
	}
	j.SetAttr("visibility", []string{"//:__subpackages__"})
	*gen = append(*gen, j)
	*imports = append(*imports, nil)
}
