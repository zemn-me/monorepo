#!/usr/bin/env bash
# a little reminder on how to sync all files in Sapling
sl pull && sl rebase -s 'draft()' -d remote/main
