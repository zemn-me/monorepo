import classNames from 'classnames';

import Link, {
	LinkProps,
} from '#root/project/me/zemn/components/Link/index.js';
import style from '#root/project/me/zemn/components/SectionLink/SectionLink.module.css';

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
