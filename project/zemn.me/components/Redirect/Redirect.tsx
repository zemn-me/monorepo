import { Link as BaseLink } from "#root/dist/bin/project/zemn.me/components/Link/index.js";
import BaseRedirect, { Props } from "#root/ts/next.js/component/Redirect/app.js";



export type RedirectProps = Props

export function Redirect({ Link = BaseLink, ...props }: RedirectProps) {
	return <BaseRedirect {...{Link, ...props}} />
}
