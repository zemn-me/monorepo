#! /usr/bin/env bash

CANNOT_BE_TESTED=125
GOOD=0
BAD=1

echo "Testing to see if renovate config is already broken..."

if ! bazel test //:validate_renovate_config_test; then
    echo "Renovate config appears already broken, striking off this commit."
    exit $CANNOT_BE_TESTED
fi

echo "force update the lockfile..."
if ! npm run pnpm i; then
    echo "Failed to update lockfile."
    exit $CANNOT_BE_TESTED
fi

echo "See if it breaks..."

EXIT_CODE=$CANNOT_BE_TESTED

if bazel test //:validate_renovate_config_test; then
    echo "Pass."
    EXIT_CODE=$GOOD
    else

    echo "Fail."
    EXIT_CODE=$BAD
fi

echo "Cleaning up..."

git reset --hard

exit $EXIT_CODE
