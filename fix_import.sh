#!/usr/bin/env bash

set -x

TARGET_FILE="$1"
TARGET_MODULE_NAME="$2"

DIRECT_FILE_OPTION="$TARGET_MODULE_NAME"
INDEX_FILE_OPTION="$TARGET_MODULE_NAME/index"


if test -f $DIRECT_FILE_OPTION.ts; then
	echo "looks like $DIRECT_FILE_OPTION.js"
    sed -i "$TARGET_FILE" -e "s?'$TARGET_MODULE_NAME'?'#monorepo/$DIRECT_FILE_OPTION.js'?g"
	exit 0
fi


if test -f ./$INDEX_FILE_OPTION.ts; then
	echo "looks like $INDEX_FILE_OPTION.js"
    sed -i "$TARGET_FILE" -e "s?'$TARGET_MODULE_NAME'?'#monorepo/$INDEX_FILE_OPTION.js'?g"

	exit 0
fi

echo "Unable to find either a match for $TARGET_MODULE_NAME; neither $DIRECT_FILE_OPTION.ts nor $INDEX_FILE_OPTION.ts matched."

exit 1

