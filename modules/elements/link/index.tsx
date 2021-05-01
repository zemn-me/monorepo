import * as Url from 'modules/url'
import React from 'react'

type MaybeSingleItemList<T> = T

type AElement = React.ReactElement<
	React.DetailedHTMLProps<
		React.AnchorHTMLAttributes<HTMLAnchorElement>,
		HTMLAnchorElement
	>
>

export interface LinkProps {
	href?: Url.URL
	children: AElement
}

export const Link = ({ href, children: child }: LinkProps) => {
	return React.cloneElement(
		child,
		{
			...child.props,
			href: href?.toString(),
		},
		//...child.props?.children,
	)
}

export default Link
