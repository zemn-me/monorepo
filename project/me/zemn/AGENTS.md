# Frontend notes

- Debug-only wiring is only acceptable if it does not ship in the production bundle. Remove temporary client-visible debugging code rather than leaving dormant fallback paths behind.
- Don't add compatibility fallbacks for web platform features that are Baseline Widely available; prefer the standard API directly unless the product explicitly needs older environments.
- New `app/` route packages must also be added to the `//project/me/zemn:ts` deps list; Gazelle does not wire that Next aggregate automatically.
- Glade opt-in routes use ordinary segment `layout.tsx` files; avoid route-group directories just to control Glade.
- Shared zemn.me menu/index links live in `project/me/zemn/navigation/navigation.ts`; update that when adding visible routes.
- Server components cannot pass function-valued selectors into client components; pass serializable selector data and rebuild the function inside the client boundary.
- For metadata-only app route types, import from `next/types`; importing package root `next` pulls ambient declarations that collide with repo shims.
- Content-addressed public assets should be declared next to the TS that imports them with `hashed_public_assets`; `project/me/zemn/public:content_addressed_public_assets` collects them from `//project/me/zemn:ts`.
- For `hashed_public_assets` generated TS modules outside `project/me/zemn`, add a `gazelle:resolve typescript` directive at the import site; Gazelle will not infer the generated module.
- `//project/me/zemn:zemn` starts the local app on port 3000; passing another `--port` appends rather than overrides.
