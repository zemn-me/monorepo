import classNames from 'classnames';

import style from '#root/project/zemn.me/components/Link/link.module.css';
import * as base from '#root/ts/react/next/Link/Link.js';

export type LinkProps = base.LinkProps

export function Link({className, ...props}: LinkProps) {

	return <base.Link className={
		classNames(className, style.link)
	} { ...props } />

}

export default Link;
