# React Router under Bazel

Generate app-local React Router entry files in the rule. The framework defaults resolve through Bazel's `node_modules` runfiles, which can break sandboxed Vite transforms for CSS and server JSX.
