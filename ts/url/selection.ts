/**
 *  • **{@link prefix}**  – optional context text that must appear *immediately* before
 *    {@link start}.  It is separated from `start` by the literal `-` char.
 *    Useful for disambiguating identical snippets.
 *    *Percent-encode* `- , &` inside the value (see {@link encodeTerm}).
 *
 *  • **{@link start}**   – **required** string that marks the beginning of the snippet.
 *    If this is the *only* term, the first match of the string is highlighted.
 *
 *  • **{@link end}**     – optional string that, together with {@link start}, bounds a
 *    range.  The match runs from the first occurrence of `start` to the first
 *    subsequent occurrence of `end`.  Recommended when the quoted text would
 *    be excessively long if placed wholly in {@link start}.
 *
 *  • **{@link suffix}**  – optional context text that must follow the snippet, delimited
 *    by `,-`.  Like {@link prefix}, it is *not* highlighted; it only helps the
 *    UA choose the correct occurrence.
 *
 * Whitespace between context terms and the target snippet is ignored by the
 * browser.  All terms are UTF-8 percent-decoded before matching.
 */
export interface TextDirective {
  /** Context immediately *before* {@link start}. */
  prefix?: string;
  /** The first text string to locate – this is mandatory. */
  start: string;
  /** Optional string that ends the match and creates a range. */
  end?: string;
  /** Context immediately *after* the matched text. */
  suffix?: string;
}


/** Percent-encode a text-directive term, escaping “-”, “,” and “&” per spec. */
function encodeTerm(term: string): string {
  return encodeURIComponent(term)
    .replace(/-/g, "%2D")
    .replace(/,/g, "%2C")
    .replace(/&/g, "%26");
}


/**
 * Adds (or appends to) a `#:~:text=` fragment on the given {@link url},
 * returning a *new* {@link URL} instance.  The input is never mutated.
 *
 * @example
 * ```ts
 * const news = linkToHighlight(
 *   new URL("https://example.com#intro"),
 *   { start: "important", prefix: "most" }
 * );
 * // → https://example.com#intro:~:text=most-,important
 * ```
 */
export function linkToHighlight(url: URL, params: TextDirective): URL {
  // Assemble the directive.
  let directive = "text=";

  if (params.prefix) directive += `${encodeTerm(params.prefix)}-,`;
  directive += encodeTerm(params.start);
  if (params.end) directive += `,${encodeTerm(params.end)}`;
  if (params.suffix) directive += `,-${encodeTerm(params.suffix)}`;

  // Work on a copy so callers get purity.
  const out = new URL(url.toString());

  // Handle existing fragments/directives.
  const frag = out.hash.startsWith("#") ? out.hash.slice(1) : out.hash;

  if (frag.includes(":~:")) {
    // Expand an existing fragment-directive block.
    const [idPart, dirPart = ""] = frag.split(":~:");
    out.hash = `${idPart}:~:${dirPart ? dirPart + "&" : ""}${directive}`;
  } else if (frag) {
    // Plain fragment present.
    out.hash = `${frag}:~:${directive}`;
  } else {
    // No fragment at all.
    out.hash = `#:~:${directive}`;
  }

  return out;
}
