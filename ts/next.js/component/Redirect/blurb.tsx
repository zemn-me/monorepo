import Link from "#root/project/zemn.me/components/Link/Link";
import { Prose } from "#root/project/zemn.me/components/Prose/prose"


interface BlurbProps {
	readonly to: URL | string
}

export function RedirectBlurb(props: BlurbProps) {
	const target = new URL(props.to);
	const text = target.protocol === "https:" ?
		target.host
		: target.origin;
	return <Prose><i>You are being redirected to <Link href={props.to}>{text}</Link>. Please wait.</i></Prose>
}
