import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo';
import useHoverMenu from 'project/zemn.me/hooks/useHoverMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import style from './NavBar.module.css';
import classes from 'classnames';
import { Link } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';
import { isNotNull } from 'ts/guard';

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
		useHoverMenu([ iconRef.current, menuRef.current ].filter(isNotNull));
	
	const springProps = useSpring({
		to: { right: menuOpen?"0": "-100%"},
		from: { right: "-100%" }
	});

	return (
		<>
			<div
				ref={iconRef}
				onClick={onToggleIconClick}
				onMouseOver={onMouseOver}
				onMouseLeave={onMouseLeave}
			>
				<FontAwesomeIcon icon={faBars} />
			</div>
			<animated.div
				ref={menuRef as any}
				onMouseOver={onMouseOver}
				onMouseLeave={onMouseLeave}
				style={springProps}
				className={classes(
					className,
					style.hamburger,
				)}
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
		<Link to="/" className={style.logo}>
			<ZemnmezLogo className={style.logoInner} >
				<title>Home</title>
			</ZemnmezLogo>
		</Link>

		<div className={style.icons}>{children}</div>
	</div>
);

export default NavBar;
