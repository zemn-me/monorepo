
# Literally why does bazel give a leading dot slash if rlocation will
# choke on it
LOCS=$(for x in $ENTRY_POINTS; do rlocation monorepo/$(echo $x | sed -e "s/^\.\///g"); done)



set -o xtrace

PULUMI_CLI=$(rlocation pulumi cli/pulumi/pulumi)




$(rlocation pulumi_cli/pulumi/pulumi) --emoji --logtostderr  $ARGS $@