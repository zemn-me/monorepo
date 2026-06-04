# MDX notes

- MDX compiles straight to JavaScript; when importing `hashed_public_assets` from MDX, generate a `.js` manifest and pass `:content_addressed_generated` through `mdx_files(assets = [...])` so the Next public asset collector sees it.
