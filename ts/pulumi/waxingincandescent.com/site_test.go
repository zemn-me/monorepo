package waxingincandescent_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bazelbuild/rules_go/go/runfiles"

	selenium "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestHomepage(t *testing.T) {
	build, err := runfiles.Rlocation("monorepo/ts/pulumi/waxingincandescent.com/build")
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.FileServer(http.Dir(build)))
	defer server.Close()

	driver, err := selenium.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()

	for _, size := range []struct {
		name          string
		width, height int
	}{
		{"desktop", 1440, 900},
		{"mobile", 390, 844},
	} {
		t.Run(size.name, func(t *testing.T) {
			if err := driver.ResizeWindow("", size.width, size.height); err != nil {
				t.Fatal(err)
			}
			if err := driver.Get(server.URL); err != nil {
				t.Fatal(err)
			}
			result, err := driver.ExecuteScript(`
				const heading = document.querySelector('main h1');
				if (!heading) return 'missing heading';
				if (heading.textContent !== 'WAXING INCANDESCENT') return heading.textContent;
				const bounds = heading.getBoundingClientRect();
				if (Math.abs(bounds.x + bounds.width / 2 - innerWidth / 2) > 2) return 'not horizontally centered';
				if (Math.abs(bounds.y + bounds.height / 2 - innerHeight / 2) > 2) return 'not vertically centered';
				if (document.documentElement.scrollWidth > innerWidth) return 'horizontal overflow';
				return document.title === 'WAXING INCANDESCENT' ? 'ok' : 'incorrect title';
			`, nil)
			if err != nil {
				t.Fatal(err)
			}
			if result != "ok" {
				t.Fatalf("homepage: %v", result)
			}
		})
	}
}
