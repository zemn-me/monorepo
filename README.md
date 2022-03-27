# Monorepo
This is a repo that has evolved over a long time, in a lot of ways from a lot of small projects.

After I joined Google, I started learning the 'bazel' tool and integrated these parts.

## Usage

The only prerequisite is `yarn`:

```bash
yarn
```

Once yarn is installed, it will pull in `bazel`. There is also `ibazel`, which is the same, but automatically re-runs itself when code is updated. Don't get it confused though! This is a polyglot repo that just happens to be bootstrapped by Node.

To list all the available build targets:

```bash
yarn bazel query //...
```

To run all tests:

```bash
yarn bazel test //...
```

The primary output of this repo is handled by the [deploy script], which simply executes a number of lesser deploy scripts. Most things that get deployed are, at this moment static websites.

The rules for static websites are in [//ts/react/server], but the long and short of it is that `_run` build targets get generated to test stuff out. For example:

```bash
yarn ibazel run //project/zemn.me:zemn.me_run
```

[deploy script]: ./deploy/deploy.sh
[//ts/react/server]: ./ts/react/server