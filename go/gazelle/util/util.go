package gazelleutil

import "github.com/bazelbuild/buildtools/build"

func StringListToExprList(strings []string) (list build.ListExpr) {
	list.List = make([]build.Expr, len(strings))

	for i, str := range strings {
		list.List[i] = &build.StringExpr{Value: str}
	}

	return
}
