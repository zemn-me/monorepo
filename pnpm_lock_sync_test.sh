#! /usr/bin/env bash

FAIL=1
SUCCESS=0
if ! $PNPM_BINARY i --frozen-lockfile --lockfile-only; then
    exit $FAIL
fi

exit $SUCCESS
