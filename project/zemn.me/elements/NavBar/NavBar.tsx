import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo';
import useHoverMenu from 'project/zemn.me/hooks/useHoverMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import style from './NavBar.module.css';
import classes from 'classnames';
import { Link } from 'react-router-dom';

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

	const [menuOpen, , onMouseOver, onMouseLeave, onToggleIconClick] =
		useHoverMenu(iconRef.current);

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
			<div
				onMouseOver={onMouseOver}
				onMouseLeave={onMouseLeave}
				className={classes(
					className,
					style.hamburger,
					menuOpen ? style.hamburgerOpen : undefined
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
			<ZemnmezLogo className={style.logoInner} />
		</Link>

		<div className={style.icons}>{children}</div>
	</div>
);

export default NavBar;
