import { expect, it } from '@jest/globals';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';

import { Schema } from '#root/ts/schema.org/schema.js';

it('renders JSON-LD as data even when values contain HTML and script closing tags', () => {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'Thing',
		name: '</script><script>alert(1)</script><b>& "quoted"</b>',
	} as const;
	const html = renderToStaticMarkup(createElement(Schema, { children: data }));
	const match = /^<script type="application\/ld\+json">([\s\S]*)<\/script>$/.exec(html);
	expect(match).not.toBeNull();
	expect(html.match(/<\/script>/gi)).toHaveLength(1);
	expect(JSON.parse(match![1]!)).toEqual(data);
});
