# Original C&C browser engines

- Build the full engines with `//project/vanilla_conquer/web:vanillara` and `:vanillatd`. Keep the source pins in `MODULE.bazel` and browser changes in `third_party/vanilla_conquer/web.patch`.
- Both engines use single-threaded Asyncify. Modal input and timing waits must yield to the browser.
- Package original data through `assets:ra_data` and `assets:td_data`. Rebuild Red Alert's MIX containers from explicit allowlists so local-disc detection works with Allied cinematics and without standalone soundtrack archives.
- Verify an asset-backed browser scenario before claiming gameplay compatibility. Keep original game data and generated Wasm outside Git.
