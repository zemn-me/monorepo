package lulu_test

import "testing"

import siteanalytics "github.com/zemn-me/monorepo/go/seleniumutil/analytics"

func TestLuluComputerSendsAnalytics(t *testing.T) {
	siteanalytics.AssertSiteSendsAnalytics(t, "@@//project/computer/lulu:itest_service")
}
