package baby_test

import "testing"

import siteanalytics "github.com/zemn-me/monorepo/go/seleniumutil/analytics"

func TestBabyComputerSendsAnalytics(t *testing.T) {
	siteanalytics.AssertSiteSendsAnalytics(t, "@@//project/computer/baby:itest_service")
}
