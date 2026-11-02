package eggsfordogs_test

import "testing"

import siteanalytics "github.com/zemn-me/monorepo/go/seleniumutil/analytics"

func TestEggsForDogsComSendsAnalytics(t *testing.T) {
	siteanalytics.AssertSiteSendsAnalytics(t, "@@//ts/pulumi/eggsfordogs.com:itest_service")
}
