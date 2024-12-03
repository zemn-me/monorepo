#!/bin/bash

set -euo pipefail

VALIDATOR_BIN="$1"
SCHEMA_FILE="$2"
shift 2

EXIT_CODE=0

for DOCUMENT in "$@"; do
    if ! "$VALIDATOR_BIN" "$SCHEMA_FILE" "$DOCUMENT"; then
        echo "Validation failed for $DOCUMENT"
        EXIT_CODE=1
    fi
done

exit $EXIT_CODE
