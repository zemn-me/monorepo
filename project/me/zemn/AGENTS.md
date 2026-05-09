# Frontend notes

- Debug-only wiring is only acceptable if it does not ship in the production bundle. Remove temporary client-visible debugging code rather than leaving dormant fallback paths behind.
- Don't add compatibility fallbacks for web platform features that are Baseline Widely available; prefer the standard API directly unless the product explicitly needs older environments.
- For prerendered React Router pages, mount `nuqs` query-state UI only after hydration so the first client render matches the static HTML.
