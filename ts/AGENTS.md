`aspect_rules_ts` exposes `ts_project` declaration outputs as `<name>_types`; for `eslint_test`, point at the main `ts_project` target (`:<name>`), not the declaration filegroup.
