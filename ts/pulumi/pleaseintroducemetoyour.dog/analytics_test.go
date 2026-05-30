package pleaseintroducemetoyourdog_test

import "testing"

import siteanalytics "github.com/zemn-me/monorepo/go/seleniumutil/analytics"

func TestPleaseIntroduceMeToYourDogSendsAnalytics(t *testing.T) {
	siteanalytics.AssertSiteSendsAnalytics(t, "@@//ts/pulumi/pleaseintroducemetoyour.dog:itest_service")
}
