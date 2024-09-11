import style from '#root/project/zemn.me/components/Link/link.module.css';
import BaseRedirect, { Props } from "#root/ts/next.js/component/Redirect/app.js";


export type RedirectProps = Props

export function Redirect({ ...props }: RedirectProps) {
	return <BaseRedirect {...{ linkClassName: style.link, ...props}} />
}
