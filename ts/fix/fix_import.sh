#!/usr/bin/env bash

function get_import_path {

    FILE_POSSIBILITIES="$(echo $1{{/index,}.{ts,js}{x,},})"
    QUERY="some(@npm//$1 union kind('ts_project rule', rdeps(//..., set($FILE_POSSIBILITIES), 1)))"

    echo "Querying $QUERY" 1>&2

    RESULT="$(yarn -s run bazel query "$QUERY" --keep_going | sed -r 's/_js$|_ts$//g')"


    echo $RESULT
    echo $RESULT 1>&2
    test -n "$RESULT"

    return $?
}

function fix_missing_module {
    echo "Fixing: $2 is missing module $1..."

    module_import_path=""

    echo "Detecting module import path for $1" 1>&2
    if ! module_import_path="$(get_import_path $1)"; then
        echo "Failure: failed to get import path for $1" 1>&2
        return 1
    fi
    echo "Detected module $1 is imported as $module_import_path" 1>&2

    file_import_path=""

    echo "Detecting file import path for $2" 1>&2
    if ! file_import_path="$(get_import_path $2)"; then
        echo "Failure: failed to get import path for $2" 1>&2
        return 1
    fi
    echo "Detected file $2 is imported as $file_import_path" 1>&2


    set -x
    if ! yarn -s run buildozer "add deps $module_import_path" $file_import_path; then
        set +x
        return 1
    fi
    set +x
    echo "Probably succeeded!" 2>&1
    return 0
}

function perform_fixes {
    if [[ "$1" == "types" ]]; then
        fix_missing_module @types/$2 $3
        return $?
    fi

    fix_missing_module $2 $3
    return $?
}



perform_fixes $@


exit $?
