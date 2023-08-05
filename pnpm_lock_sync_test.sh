#! /usr/bin/env bash
if $PNPM_BINARY i --frozen-lockfile --offline | grep -q ERR_PNPM_OUTDATED_LOCKFILE; then
    exit 1
fi

exit 0
