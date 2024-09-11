import React, { ReactNode } from "react";

import { Prose } from "#root/project/zemn.me/components/Prose/prose.js"
import BaseLink from "#root/ts/react/next/Link/Link.js";


interface BlurbProps {
	readonly to: URL | string
	readonly Link?: (v: { href: URL | string, children?: ReactNode }) => ReactNode
}

export function RedirectBlurb({ Link = BaseLink, ...props }: BlurbProps) {
	const target = new URL(props.to);
	const text = target.protocol === "https:" ?
		target.host
		: target.origin;
	return <Prose><i>You are being redirected to <Link href={props.to}>{text}</Link>. Please wait.</i></Prose>
}
