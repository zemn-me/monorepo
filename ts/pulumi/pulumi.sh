

longest_common_prefix()
{
    declare -a names
    declare -a parts
    declare i=0

    names=("$@")
    name="$1"
    while x=$(dirname "$name"); [ "$x" != "/" -a "$x" != "." ]
    do
        parts[$i]="$x"
        i=$(($i + 1))
        name="$x"
    done

    for prefix in "${parts[@]}" /
    do
        for name in "${names[@]}"
        do
            if [ "${name#$prefix/}" = "${name}" ]
            then continue 2
            fi
        done
        echo "$prefix"
        break
    done
}

echo $ENTRY_POINTS
LOCS=$(for x in $ENTRY_POINTS; do rlocation quickcult/$x; done)

echo LOCS $LOCS

BASE_DIR=$(longest_common_prefix $ENTRY_POINTS)

set -o xtrace



$(rlocation pulumi_cli/pulumi/pulumi) --emoji --logtostderr --non-interactive -C $BASE_DIR $ARGS $@