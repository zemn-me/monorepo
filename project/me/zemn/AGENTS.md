# Frontend notes

- Debug-only wiring is only acceptable if it does not ship in the production bundle. Remove temporary client-visible debugging code rather than leaving dormant fallback paths behind.
- Don't add compatibility fallbacks for web platform features that are Baseline Widely available; prefer the standard API directly unless the product explicitly needs older environments.
- New `app/` route packages must also be added to the `//project/me/zemn:ts` deps list; Gazelle does not wire that Next aggregate automatically.
