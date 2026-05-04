#!/usr/bin/env bash

# Bazel runs this at the start of builds to collect workspace metadata.
# BuildBuddy reads these keys to group invocations by repo, commit, and branch.

set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$workspace_dir"

emit_default_status() {
  echo "REPO_URL"
  echo "COMMIT_SHA dev"
  echo "BRANCH_NAME unknown"
  echo "GIT_BRANCH unknown"
  echo "GIT_TREE_STATUS Unknown"
  echo "STABLE_VERSION_TAG dev"
  echo "STABLE_COMMIT_SHA dev"
}

remove_url_credentials() {
  if command -v perl >/dev/null 2>&1; then
    perl -pe 's#//.*?:.*?@#//#'
  else
    sed -E 's#//[^/@]*:[^/@]*@#//#'
  fi
}

env_branch_name() {
  if [[ -n "${GITHUB_HEAD_REF:-}" ]]; then
    echo "$GITHUB_HEAD_REF"
  elif [[ "${GITHUB_REF:-}" == refs/heads/* ]]; then
    echo "${GITHUB_REF#refs/heads/}"
  elif [[ "${GITHUB_REF_TYPE:-}" == "branch" && -n "${GITHUB_REF_NAME:-}" ]]; then
    echo "$GITHUB_REF_NAME"
  elif [[ -n "${CIRCLE_BRANCH:-}" ]]; then
    echo "$CIRCLE_BRANCH"
  elif [[ -n "${BUILDKITE_BRANCH:-}" ]]; then
    echo "$BUILDKITE_BRANCH"
  elif [[ -n "${BITRISE_GIT_BRANCH:-}" ]]; then
    echo "$BITRISE_GIT_BRANCH"
  elif [[ -n "${TRAVIS_BRANCH:-}" ]]; then
    echo "$TRAVIS_BRANCH"
  elif [[ -n "${GIT_BRANCH:-}" ]]; then
    echo "$GIT_BRANCH"
  elif [[ -n "${CI_COMMIT_BRANCH:-}" ]]; then
    echo "$CI_COMMIT_BRANCH"
  elif [[ -n "${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME:-}" ]]; then
    echo "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
  fi
}

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  emit_default_status
  exit 0
fi

repo_url="$(git config --get remote.origin.url 2>/dev/null || true)"
repo_url="$(printf "%s" "$repo_url" | remove_url_credentials)"
if [[ -n "$repo_url" ]]; then
  echo "REPO_URL $repo_url"
else
  echo "REPO_URL"
fi

commit_sha="$(git rev-parse HEAD 2>/dev/null || echo "dev")"
echo "COMMIT_SHA $commit_sha"

git_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [[ -z "$git_branch" ]]; then
  git_branch="$(env_branch_name || true)"
fi
if [[ -z "$git_branch" ]]; then
  git_branch="unknown"
fi
echo "BRANCH_NAME $git_branch"
echo "GIT_BRANCH $git_branch"

if [[ "$commit_sha" == "dev" ]]; then
  git_tree_status="Unknown"
elif git diff-index --quiet HEAD --; then
  git_tree_status="Clean"
else
  git_tree_status="Modified"
fi
echo "GIT_TREE_STATUS $git_tree_status"

# STABLE_ keys can affect stamped actions, so keep this limited to values that
# stamped targets commonly need.
latest_version_tag="$(
  git tag -l "v*" --sort=creatordate |
    awk '/^v[0-9]+\.[0-9]+\.[0-9]+$/ { tag = $0 } END { print tag }'
)"
if [[ -z "$latest_version_tag" ]]; then
  latest_version_tag="dev"
fi
echo "STABLE_VERSION_TAG $latest_version_tag"
echo "STABLE_COMMIT_SHA $commit_sha"
