Problem of CSS Modules In Next.js Under Bazel
=============================================

CSS modules and next.js under Bazel do not play well. Multiple options have been tried, and all so far have failed. This document captures what has gone wrong so far, and what I hope to try next.

Why Don't CSS Modules work in Next.js Under Bazel?
--------------------------------------------------

For some reason, next.js is opinionated about where you can put CSS and CSS modules. Threads on its GitHub page have stated this is due to the way that Next.js resolves dependency trees.

rules_nodejs, the Bazel package used for making TypeScript and JavaScript work in Bazel, uses node_modules to help sources find each other -- for example, for the monorepo source `//something:something.ts`, TypeScript sees it in `monorepo/something/something.ts`.

What should we try?
-------------------

[next-transpile-modules]: https://www.npmjs.com/package/next-transpile-modules

 - [x] **[next-transpile-modules]** (tried in b1eab08c5b53323fa78186f3ea6248625142c8a9). This is a very widely used NPM package which simply allows transpilation of modules in node_modules under next.js. It *seems* like a perfect solution, but in reality it expects every node_modules package to have a 'package.json'. Of course, `rules_nodejs` generated node_modules for the monorepo are not actually packages.

[rust css transpiler]: https://github.com/Zemnmez/monorepo/tree/v0.0.0-1670718861159-fc29f18c07f7d0506b401d179ef308ebf9c9a75a/rs/css/module

 - [x] **[transpiling css modules to typescript + css][rust css transpiler]**. This was quite a lift (and a learning experience!), but ultimately failed, because not only does next.js not allow CSS modules in node_mdules, it *also* does not allow plain CSS files!!

[aspects]: https://bazel.build/extending/aspects
[copying next.config.ts]: https://github.com/Zemnmez/monorepo/blob/v0.0.0-1670718861159-fc29f18c07f7d0506b401d179ef308ebf9c9a75a/ts/next.js/rules.bzl#L37
[declare_symlink]: https://bazel.build/rules/lib/actions#declare_symlink

 - [ ] **Tricking Next.js into thinking the CSS modules or CSS are in the next root**. I think there is a significant probability that this would work. I already [copy the next.config.ts][copying next.config.ts] into the Next.js config directory. I'd need to create a Bazel [aspect][aspects] to determine all the sources in the monorepo, recursively. Then I could build an alternative tree via [symlinks][declare_symlink] in the Next root, i.e. `pages/; monorepo/ monorepo/dep monorepo/dep/module.css`.