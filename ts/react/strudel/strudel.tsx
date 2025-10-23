/**
 * @fileoverview Mini Strudel REPL
 * @see https://codeberg.org/uzu/strudel/src/commit/c823a37c93a0669268cbeda1654c0e3294c0f0ef/website/src/docs/MiniRepl.jsx
 */

import Link from "#root/project/zemn.me/components/Link/index.js";

function strudelShareLink(code: string) {
  const b64 = Buffer
    .from(code, "utf8")
    .toString("base64")
    .replace(/=+$/, ""); // trim padding
  return `https://strudel.cc/#${b64}`;
}

export interface StrudelProps {
  readonly code: string;
}

export function Strudel({code}: StrudelProps) {
	return <Link href={strudelShareLink(code)}><code>
		{code}
	</code></Link>
}

