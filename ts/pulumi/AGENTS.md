Keep `rules_itest` services next to the site package that owns the app. The shared `ts/pulumi/testing` package should only assemble cross-site test harnesses, not define downstream site launchers.
