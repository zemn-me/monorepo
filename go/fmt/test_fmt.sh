set -e
DIFF=$($GOFMT -d -s $@)
echo "$DIFF"
test -z "$DIFF"

echo code $?
set +e
exit $?
