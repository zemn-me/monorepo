import classNames from 'classnames';

import style from '#root/project/zemn.me/components/Link/link.module.css';
import * as base from '#root/ts/react/next/Link/Link.js';

export interface LinkProps extends base.LinkProps {
	readonly styleless?: boolean
}

export function Link({className, styleless, ...props}: LinkProps) {

	return <base.Link className={
		classNames(className, styleless? undefined: style.link)
	} {...{ styleless, ...props } } />

}

export default Link;
