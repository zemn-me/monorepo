import { faBars } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classes from 'classnames';
import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo';
import useHoverMenu from 'project/zemn.me/hooks/useHoverMenu';
import React from 'react';
import { Link } from 'react-router-dom';
import { animated, useSpring } from 'react-spring';
import { isNotNull } from 'ts/guard';

import style from './NavBar.module.css';

export const NavBarIcons: React.FC<
	React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	>
> = ({ className, ...props }) => (
	<div className={classes(className, style.navBarIcons)} {...props} />
);

export const Hamburger: React.FC<
	React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	>
> = ({ className, ...props }) => {
	const iconRef = React.useRef<HTMLDivElement>(null);
	const menuRef = React.useRef<HTMLDivElement>(null);

	const [menuOpen, , onMouseOver, onMouseLeave, onToggleIconClick] =
		useHoverMenu([iconRef.current, menuRef.current].filter(isNotNull));

	const springProps = useSpring({
		to: { right: menuOpen ? '0' : '-100%' },
		from: { right: '-100%' },
	});

	return (
		<>
			<div
				onClick={onToggleIconClick}
				onMouseLeave={onMouseLeave}
				onMouseOver={onMouseOver}
				ref={iconRef}
			>
				<FontAwesomeIcon icon={faBars} />
			</div>
			<animated.div
				className={classes(className, style.hamburger)}
				onMouseLeave={onMouseLeave}
				onMouseOver={onMouseOver}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				ref={menuRef as any}
				style={springProps}
				{...props}
			/>
		</>
	);
};

export const NavBar: React.FC<
	React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	>
> = ({ className, children, ...props }) => (
	<div className={classes(className, style.navBar)} {...props}>
		<Link className={style.logo} to="/">
			<ZemnmezLogo className={style.logoInner}>
				<title>Home</title>
			</ZemnmezLogo>
		</Link>

		<div className={style.icons}>{children}</div>
	</div>
);

export default NavBar;
