"""Browser tests with an isolated production service stack."""

load("@io_bazel_rules_go//go:def.bzl", "go_test")
load("@rules_itest//private:itest.bzl", "service_test")

def browser_test(name, tags = [], **kwargs):
    """Wrap a Gazelle-generated Go test in the browser integration harness."""
    binary = name + "_binary"
    go_test(
        name = binary,
        tags = tags + ["manual"],
        **kwargs
    )
    service_test(
        name = name,
        size = "large",  # Production bundling and full browser flows can exceed five minutes.
        flaky = True,
        # Chrome otherwise reports navigator.onLine=false in an interface-less
        # container, so local API uploads remain queued without being attempted.
        exec_properties = {"test.network": "external"},
        services = [
            "//project/me/zemn:itest_service_calendar_fixture",
            "//project/me/zemn/testing:oidc_provider_itest_service",
        ],
        tags = tags,
        test = ":" + binary,
    )
