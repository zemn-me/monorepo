#!/usr/bin/env bash


bazel="yarn -s run bazel"

function targets_with_given_source {
    if fullname=$($bazel query "$1"); then
        if TARGET="$($bazel query "attr('srcs', $fullname, ${fullname//:*/}:*)" | grep ts | head -1)"; then
            if [ ! -z "$TARGET" ]; then
                echo $TARGET | sed -r 's/_js$|_ts$//g'
                return 0
            fi
        fi
    fi
    return 1
}

function is_installed_npm_package {
    echo "Is $1 an npm package?" 1>&2
    if yarn why "$1" | grep Found > /dev/null; then
        echo "Success! $1 is an npm package!" 1>&2
        return 0
    fi

    echo "Seems like $1 is not an npm package..." 1>&2

    return 1
}

function tag_for_file {
    targets_with_given_source $1
}

function find_tsjs_module_tag {
    echo "Trying to find the tsjs module / file for $1..." 1>&2
    echo "What about just $1?" 1>&2
    if attempt="$(tag_for_file $1)"; then
        echo $1$suffix is built by $attempt! 1>&2
        echo $attempt
        return 0
    fi
    echo "Not just $1..." 1>&2

    for suffix in {/index,}.{ts,js}{x,}; do
        echo "Does $1$suffix exist?" 1>&2
        if attempt="$(tag_for_file $1$suffix)"; then
            echo $1$suffix is built by $attempt! 1>&2
            echo $attempt
            return 0
        fi
        echo "$1$suffix does not exist..." 1>&2
    done

    return 1
}

function get_import_path {
    echo "Detecting import path for $1" 1>&2
    if is_installed_npm_package $1; then
        echo "Looks like $1 is an npm package :)" 1>&2
        echo "@npm//$1"
        return 0
    fi

    
    if ! import_tag="$(find_tsjs_module_tag $1)"; then
        echo "Unable to locate module $1" 1>&2
        return 1
    fi

    echo Located module $1 at $import_tag 1>&2

    echo $import_tag
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

    echo '??' $module_import_path
    
    file_import_path=""

    echo "Detecting file import path for $2" 1>&2
    if ! file_import_path="$(get_import_path $2)"; then
        echo "Failure: failed to get import path for $2" 1>&2
        return 1
    fi
    echo "Detected file $2 is imported as $file_import_path" 1>&2


    echo '??' $module_import_path
    
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
