# Minecraft image

`//project/me/zemn/minecraft:image` is the shared test/deployment artifact. Its
launcher tag and digest live in `MODULE.bazel`; `minecraft.env` pins the game
version downloaded at startup. Renovate manages both. Keep runtime `VERSION`
overrides out of tests and Pulumi so they run the same release.
