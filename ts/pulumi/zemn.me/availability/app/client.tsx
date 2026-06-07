'use client';

import { useEffect } from 'react';

export interface Props {
	readonly href: string;
}

export function ClientSideRedirect({ href }: Props) {
	useEffect(() => {
		window.location.replace(href);
	}, [href]);

	return null;
}
