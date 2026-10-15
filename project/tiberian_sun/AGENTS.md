# Browser engine

- Build the complete runtime with `//project/tiberian_sun/web:engine`; the LCW probe is only a codec test.
- Keep the source pin and browser patch in `MODULE.bazel` and `third_party/opents`. Keep generated engine outputs and original game assets out of Git.
- The browser uses one thread with Asyncify. Waits for audio or input must yield to the event loop; native sleeps can deadlock the audio feeder.
- Verify an asset-backed scenario in a browser before claiming runtime compatibility. Asset-free tests alone establish compilation and packaging.
