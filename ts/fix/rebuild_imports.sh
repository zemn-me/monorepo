#!/usr/bin/env bash
yarn buildozer 'remove deps' $(yarn bazel query 'kind("ts_project rule", //...)' | sed 's/_ts$//g')

yarn -s ib build --keep_going //...

yarn fix