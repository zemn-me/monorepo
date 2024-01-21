import classNames from 'classnames';
import Link, { LinkProps } from 'project/zemn.me/components/Link';
import style from 'project/zemn.me/components/SectionLink/SectionLink.module.css';

export const SectionLink: React.FC<LinkProps> = ({
	className,
	children,
	...props
}) => (
	<Link
		{...props}
		className={classNames(style.sectionLink, className)}
		rel="bookmark"
	>
		{children}
	</Link>
);
