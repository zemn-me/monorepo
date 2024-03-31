# Bazel workspace created by @bazel/create 3.7.0

# Needed by Protobuf
bind(
    name = "python_headers",
    actual = "@com_google_protobuf//:protobuf_headers",
)

# Declares that this directory is the root of a Bazel workspace.
# See https://docs.bazel.build/versions/master/build-ref.html#workspace
workspace(
    # How this workspace would be referenced with absolute labels from another workspace
    name = "monorepo",
)

load("//bzl:deps.bzl", "fetch_dependencies")

fetch_dependencies()

load("@bazel_features//:deps.bzl", "bazel_features_deps")

bazel_features_deps()

load("@rules_pkg//:deps.bzl", "rules_pkg_dependencies")

rules_pkg_dependencies()

load("@bazel_skylib//:workspace.bzl", "bazel_skylib_workspace")

bazel_skylib_workspace()

load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")

go_rules_dependencies()

load("//:go_version.bzl", "go_version")

go_register_toolchains(version = go_version)

# below line needed because deps are defined in bzl/deps.bzl
# gazelle:repo bazel_gazelle
load("@bazel_gazelle//:deps.bzl", "gazelle_dependencies")
load("//bzl:go_deps.bzl", "go_dependencies")

# gazelle:repository_macro bzl/go_deps.bzl%go_dependencies
go_dependencies()

# If you use WORKSPACE.bazel, use the following line instead of the bare gazelle_dependencies():
# gazelle_dependencies(go_repository_default_config = "@//:WORKSPACE.bazel")
gazelle_dependencies()

load("@com_google_protobuf//:protobuf_deps.bzl", "protobuf_deps")

protobuf_deps()

load("@rules_nodejs//nodejs:repositories.bzl", "DEFAULT_NODE_VERSION", "nodejs_register_toolchains")

# force node version to be above 18
# this should eventually be loaded from package.json engines.

nodejs_register_toolchains(
    name = "nodejs",
    node_version = DEFAULT_NODE_VERSION if int(DEFAULT_NODE_VERSION.split(".")[0]) > 18 else "18.13.0",
)

load("@npm//:repositories.bzl", "npm_repositories")

npm_repositories()

load("@aspect_bazel_lib//lib:repositories.bzl", "register_copy_directory_toolchains", "register_copy_to_directory_toolchains", "register_coreutils_toolchains")

register_coreutils_toolchains()

##################
# rules_ts setup #
##################
# Fetches the rules_ts dependencies.
# If you want to have a different version of some dependency,
# you should fetch it *before* calling this.
# Alternatively, you can skip calling this function, so long as you've
# already fetched all the dependencies.
load("@aspect_rules_ts//ts:repositories.bzl", "rules_ts_dependencies")

rules_ts_dependencies(

    # Alternatively, you could pick a specific version, or use
    # load("@aspect_rules_ts//ts:repositories.bzl", "LATEST_VERSION")
    # ts_version = LATEST_VERSION

    # HEAD is currently further along than rules_ts has patches for.
    # this will break updates to typescript, so should probably be removed when
    # rules_ts is updated.
    # As per https://docs-legacy.aspect.build/aspect-build/rules_ts/v0.10.0/docs/repositories-docgen.html
    # Generate via
    # curl --silent https://registry.npmjs.org/typescript/5.0.3 | jq -r '.dist.integrity'
    #ts_integrity = "sha512-cW9T5W9xY37cc+jfEnaUvX91foxtHkza3Nw3wkoF4sSlKn0MONdkdEndig/qPBWXNkmplh3NzayQzCiHM4/hqw==",
    # This keeps the TypeScript version in-sync with the editor, which is typically best.
    ts_version_from = "//:package.json",
)

register_copy_directory_toolchains()

register_copy_to_directory_toolchains()

###################
# rules_swc setup #
###################

# Fetches the rules_swc dependencies.
# If you want to have a different version of some dependency,
# you should fetch it *before* calling this.
# Alternatively, you can skip calling this function, so long as you've
# already fetched all the dependencies.
load("@aspect_rules_swc//swc:dependencies.bzl", "rules_swc_dependencies")

rules_swc_dependencies()

# Fetches a SWC cli from
# https://github.com/swc-project/swc/releases
# If you'd rather compile it from source, you can use rules_rust, fetch the project,
# then register the toolchain yourself. (Note, this is not yet documented)
load("@aspect_rules_swc//swc:repositories.bzl", "LATEST_VERSION", "swc_register_toolchains")

swc_register_toolchains(
    name = "swc",
    swc_version = LATEST_VERSION,
)
