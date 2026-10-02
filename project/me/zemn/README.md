zemn.me
-------

This React Router framework app (the successor to Remix's React framework)
hosts [zemn.me], my personal website.

`bazel run //project/me/zemn:zemn` starts the local app and API services.
`bazel build //project/me/zemn:build` produces browser assets in `build/` and
an independent Node 24 Lambda bundle in `server/`. `bazel run
//project/me/zemn:start` serves that production build locally.

CloudFront serves the generated public-asset namespaces from S3 and sends
page and loader requests to the Remix Lambda through an HTTP API. The API
requires a secret origin header supplied by CloudFront. Both staging and
production use this deployment through the existing Pulumi workflow.

Public pages listed in `react-router.config.mjs` are prerendered. Anonymous
requests without query parameters can use those HTML and `.data` snapshots,
with a five-minute shared-cache lifetime and up to one day of background
revalidation. Snapshots change when deployed; this is not incremental static
regeneration. Query-dependent requests and paths outside that list run the
server loaders. Journal, admin, callback, key, and health routes are excluded
from prerendering. For new backend-driven pages, exclude their paths too.

Runtime responses default to `private, no-store`. Public loaders can opt in
with `Cache-Control: public, max-age=0, s-maxage=300,
stale-while-revalidate=86400`; document routes must propagate their loader's
headers through the route `headers` export. Cookie/Authorization requests,
Set-Cookie responses, mutations, errors, and responses varying on headers
outside the CDN cache key always bypass shared caching. CloudFront forwards
all query parameters (including React Router's `_routes`), cookies and
Authorization, and keys cached responses accordingly.

The journal wiki still fetches authenticated data in the browser. Server-side
wiki data loading will need an explicit authentication handoff; enabling SSR
does not expose private journal data or move tokens into server storage.

The Lambda adapter buffers HTML and loader responses within Lambda's 6 MB
response limit and the HTTP API's 29-second integration timeout. Large media
stays in S3. Streaming responses and long-running actions require a different
adapter or origin. Rolling back `serverDirectory` in the Website deployment
also requires restoring the static build configuration; keep both changes in
the same rollback.

Register routes in `app/routes.ts` using the compiled `.js` module paths and
add their packages to `//project/me/zemn:ts`. Put pages that use the shared
hero, navigation, and footer inside the pathless `glade-layout.js` group.
Standalone pages, such as Endings, belong beside that group; their URLs do
not need to follow a separate directory structure. The root keeps shared
providers, document metadata, and analytics for both groups.

Shared build configuration,
metadata handling, and integration fixtures live under `//ts/remix`.

[zemn.me]: https://zemn.me
