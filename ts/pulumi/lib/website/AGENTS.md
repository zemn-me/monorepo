# CloudFront Static Sites

For React Router prerendered builds, set `cleanIndexRoutes` so nested `route/index.html` files upload at the clean S3 key CloudFront requests for `/route`. Use `__spa-fallback.html` with a 200 response for SPA fallback paths.
