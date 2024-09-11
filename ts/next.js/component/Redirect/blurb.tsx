import React from "react";

import { Prose } from "#root/project/zemn.me/components/Prose/prose.js"
import Link from "#root/ts/react/next/Link/Link.js";


interface BlurbProps {
	readonly to: URL | string
	readonly linkClassName?: string
}

export function RedirectBlurb({ linkClassName: className, ...props }: BlurbProps) {
	const target = new URL(props.to);
	const text = target.protocol === "https:" ?
		target.host
		: target.origin;
	return <Prose><i>You are being redirected to <Link {...{className}} href={props.to}>{text}</Link>. Please wait.</i></Prose>
}
