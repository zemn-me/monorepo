zemn.me
-------

This React Router framework app (the successor to Remix's React framework)
hosts [zemn.me], my personal website.

`bazel run //project/me/zemn:zemn` starts the local app and API services.
`bazel build //project/me/zemn:build` prerenders the site for static hosting.
The exported `build/` directory retains extensionless CloudFront page URLs.
Loaders run during prerendering; deploy their `.data` files alongside the HTML.

Register routes in `app/routes.ts` using the compiled `.js` module paths and
add their packages to `//project/me/zemn:ts`. Put pages that use the shared
hero, navigation, and footer inside the pathless `glade-layout.js` group.
Standalone pages, such as Endings, belong beside that group; their URLs do
not need to follow a separate directory structure. The root keeps shared
providers, document metadata, and analytics for both groups.

Shared build configuration,
metadata handling, and integration fixtures live under `//ts/remix`.

[zemn.me]: https://zemn.me
