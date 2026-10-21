# Original C&C browser engines

- Build the full engines with `//project/vanilla_conquer/web:vanillara` and `:vanillatd`. Keep the source pins in `MODULE.bazel` and browser changes in `third_party/vanilla_conquer/web.patch`.
- Both engines use single-threaded Asyncify. Modal input and timing waits must yield to the browser.
- Package original data through `assets:ra_data` and `assets:td_data`. Keep core MIX data free of movies/music. Build individual movie packets through `assets:ra_cinematics`; the native playback hook must await only the requested clip and release it afterward.
- Verify an asset-backed browser scenario before claiming gameplay compatibility. Keep original game data and generated Wasm outside Git.
