Submit Project
==============

At the time of commit, the monorepo works as such:

1. Commits come in to 'main', and are merged as all tests
   except those marked DO_NOT_RUN_ON_MAIN pass.

2. Every day, commits from main are copied from 'main' to 'versioned'.
   A janky bash script runs to perform 'automatic fixes' to perform extra
   actions such as bumping versions.

3. Once the copy is complete, a postsubmit runs which performs a 'deploy',
   'npx @bazel/bazelisk run //deploy'. This uploads NPM packages and performs
   a pulumi deploy.

This has a few issues.

1. **Remote resources**. Since the pulumi up is not performed until (3), lots of
   commits can land which break the pulumi build. The same goes for NPM.

2. **Branch deletion**. The main / versioned branch thing is just weird. Occasionally,
   I delete the 'versioned' branch, and this results in everything not working.

Proposal
--------

```
+-----------------------------+
| 1.       PRESUBMIT          |
+-----------------------------+
  |  
  | All offline tests succeed.
  |
  |   - bazel test //...
  v
+-----------------------------+
| 2.  AUTHORIZATION CHECK     |
+-----------------------------+
  | The next step will not run
  | until one of the repo owners
  | approves the commits.
  |
  v
+-----------------------------+
| 3.        SUBMIT            |
+-----------------------------+
  | Deploy actions that can
  | be rolled back performed.
  |
  |  - Pulumi up
  v
+-----------------------------+
| 3a.       ROLLBACK          |
+-----------------------------+
  | Upon failure of step 3,
  | checkout origin/main,
  | and re-perform SUBMIT.
  x
+-----------------------------+
| 4.      POSTSUBMIT          |
+-----------------------------+
  | When (3) succeeds,
  |
  | Deploy actions that cannot
  | be rolled back performed.
  |
  |  - Creating a GitHub release
  |  - Uploading NPM packages
  v
+-----------------------------+
| 5.         MERGE            |
+-----------------------------+

```

**The wanted end-state *must settle* before merging.**

 - Remove the CRON based deploy process.
 - Run _all bazel tests_ on all PRs. This means no DO_NOT_RUN_ON_MAIN.
 - This will necessitate elimination of the need for this step.
  - There will neeed to be a single command that can be used to fix commits
     that previously were part of the DO_NOT_RUN_ON_MAIN flow.

**Pulumi rollbacks**

- Part of our issue is that Pulumi does not have a 'rollback' feature. If I 'pulumi up' a partially
  broken infra, we can only 'roll back' by 'pulumi up'-ing a known good build.

- This is mostly okay in this workflow, as each PR that fails final merge
  will be overridden by the next that does not.

- I am concerned about if I attempt submit of a PR and it fails and there is no other PR attempting
  a submit. In this case, there is no second attempt at 'pulumi up' to roll back.

Todo list
---------

1. [ ] Introduce a PRESUBMIT
2. [ ] and SUBMIT script in `//` that are source of truth for their relevant step
3. [ ] Introduce a FIX script in `//` that automatically performs necessary fixes including
   (1) rust deps fix (repinning); (2) version bumping; (3) automatic lint fixes.
4. [ ] Introduce a POSTSUBMIT script in `//` that performs tasks after submission is complete.
       This is necessary because several actions do not have state entirely internal to the repo
       (e.g. github release versions, npm release versions).

       Eventually, it might be potentially possible to make these presubmit e.g. by adding a version
       list to the repo and having pulumi deploy versions.

    a. Split out 'deploy' into 'presubmit' and 'postsubmit' phases, where 'presubmit' includes stuff
       that does not break stuff or can roll back (pulumi), and 'postsubmit' is stuff that
       can't reasonably be rolled back, like github version publications.
5. [ ] Alter the merge workflow to require a green 'SUBMIT' script run. This workflow
       will necessarily be privileged, so will need allowlisting for the renovate bot.