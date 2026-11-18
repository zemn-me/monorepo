import type {} from 'trusted-types';

/**
 * React creates inert script elements by parsing this fixed, empty template.
 * Keep this exception exact: application HTML must never pass through it.
 */
if (typeof window !== 'undefined' && window.trustedTypes) {
	window.trustedTypes.createPolicy('default', {
		createHTML(value) {
			if (value === '<script></script>') return value;
			throw new TypeError('HTML string injection is disabled');
		},
	});
}
