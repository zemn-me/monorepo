# Frontend notes

## UI design

Apply these lessons from the journal UI to zemn.me, using Apple's Human
Interface Guidelines as a reference for interaction and clarity:

- Keep routine [feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
  beside the affected item. Use familiar icons, selection states, placeholders,
  and disclosure controls; avoid repeating the same state in headings, captions,
  and explanatory paragraphs. Keep primary actions discoverable.
- [Write](https://developer.apple.com/design/human-interface-guidelines/writing)
  only what helps someone understand or act. Keep necessary labels and brief,
  actionable errors; omit storage, sync, and processing implementation details
  from routine UI. Icon-only controls need accessible names and tooltips.
- Use measured [progress](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
  when a total is known; use indeterminate activity otherwise. Keep its location,
  footprint, and circular or linear shape stable as work advances. Don't invent
  percentages or show duplicate indicators for the same operation.
- Preserve [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility):
  semantic controls, keyboard access, visible focus, readable palette-based
  contrast, and reduced motion. Don't rely on color or hover alone for meaning.
- Adapt Apple's [layout and touch guidance](https://developer.apple.com/design/tips/)
  to the web: aim for at least 44 × 44 CSS-pixel touch targets, even for small
  glyphs. Keep the active navigation item and capture controls visible on phones;
  don't let fixed controls obscure content or force horizontal page scrolling.
- Inspect the actual changed states in a local browser at desktop and phone
  widths, including keyboard focus and errors. Check screenshots for contrast,
  clipping, and hierarchy; passing behavior tests alone missed invisible journal
  metadata and a hidden selected tab. Reuse the site's visual language.

## Implementation

- Debug-only wiring is only acceptable if it does not ship in the production bundle. Remove temporary client-visible debugging code rather than leaving dormant fallback paths behind.
- Don't add compatibility fallbacks for web platform features that are Baseline Widely available; prefer the standard API directly unless the product explicitly needs older environments.
- New `app/` route packages must also be added to the `//project/me/zemn:ts` deps list; Gazelle does not wire that Next aggregate automatically.
- Mount Glade only in the root layout so its hero video persists across navigation. Full-screen route exceptions belong in Glade, not per-route wrappers.
- Shared zemn.me menu/index links live in `project/me/zemn/navigation/navigation.ts`; update that when adding visible routes.
- Server components cannot pass function-valued selectors into client components; pass serializable selector data and rebuild the function inside the client boundary.
- In React code, prefer carrying async/remote values with `ts/future/future.ts` helpers over duplicating messy internal loading/error state.
- Prefer `project/me/zemn/api/spec.yaml` and its generated API types over hard-coding duplicate request/response types.
- URL query hooks such as `useQueryState` need an enclosing Suspense boundary for static export. Verify `//project/me/zemn:build`; development-server browser tests do not catch prerender failures.
- For metadata-only app route types, import from `next/types`; importing package root `next` pulls ambient declarations that collide with repo shims.
- Content-addressed public assets should be declared next to the TS that imports them with `hashed_public_assets`; `project/me/zemn/public:content_addressed_public_assets` collects them from `//project/me/zemn:ts`.
- For `hashed_public_assets` generated TS modules outside `project/me/zemn`, add a `gazelle:resolve typescript` directive at the import site; Gazelle will not infer the generated module.
- `//project/me/zemn:zemn` starts the local app on port 3000; passing another `--port` appends rather than overrides.
- The dev server reads Bazel-copied inputs; if rebuilt CSS stays stale in the preview, restart `//project/me/zemn:zemn` before reloading the browser.
- Signed media range failures can leave an HTML media element stalled without an `error`; preserve playback intent and recover from `waiting`/`stalled` as well as hard errors.

- Keep local `api/server.Server.ProvisionTables` indexes aligned with Pulumi; analytics listing requires `feed-when-index`, which ingest-only tests do not exercise.
