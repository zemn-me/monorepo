# Copyright 2019 The Bazel Authors. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

load("//wasm_bindgen/raze:crates.bzl", "raze_fetch_remote_crates")
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

def maybe(workspace_rule, **kwargs):
    if not native.existing_rule(kwargs["name"]):
        workspace_rule(**kwargs)

def rust_wasm_bindgen_repositories():
    """Declare dependencies needed for bindgen."""

    raze_fetch_remote_crates()

    http_archive(
        name = "wasm_bindgen_backtrace_sys_0_1_29",
        url = "https://crates-io.s3-us-west-1.amazonaws.com/crates/backtrace-sys/backtrace-sys-0.1.29.crate",
        type = "tar.gz",
        sha256 = "12cb9f1eef1d1fc869ad5a26c9fa48516339a15e54a227a25460fc304815fdb3",
        strip_prefix = "backtrace-sys-0.1.29",
        build_file = Label("//wasm_bindgen/raze/overrides:backtrace-sys-0.1.29.BUILD"),
    )

    native.register_toolchains("@io_bazel_rules_rust//wasm_bindgen:example-wasm-bindgen-toolchain")
