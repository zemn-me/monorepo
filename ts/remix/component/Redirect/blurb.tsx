import React from 'react';

import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import Link from '#root/ts/react/router/Link/Link.js';

interface BlurbProps {
	readonly to: URL | string;
	readonly linkClassName?: string;
}

export function RedirectBlurb({
	linkClassName: className,
	...props
}: BlurbProps) {
	const href = props.to.toString();
	const target = URL.canParse(href) ? new URL(href) : undefined;
	const text = target?.protocol === 'https:' ? target.host : href;
	return (
		<Prose>
			<i>
				You are being redirected to{' '}
				<Link {...{ className }} href={props.to}>
					{text}
				</Link>
				. Please wait.
			</i>
		</Prose>
	);
}
