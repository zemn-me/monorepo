# Monorepo

This is a bazel monorepo that I'm hoping eventually will contain most of my side-projects.

Via the github actions workflows in [.github/workflows/ci.yml], changes in any dependencies are automatically tested and merged.

Then, a secondary action runs which increments any version numbers necessary and commits to the [versioned branch]. This branch tracks and increments versions for export to third-party package managers like NPM.

[.github/workflows/ci.yml]: .github/workflows/ci.yml
[versioned branch]: https://github.com/Zemnmez/monorepo/tree/versioned

The deploy scripts in [deploy/BUILD] run only on the versioned branch.


[deploy/build]: deploy/BUILD