/**
 * @fileoverview
 * a little hamburger SVG icon.
 *
 * It acts a little strangely (on purpose) because it uses absolute positioning within
 * the SVG. If the hamburger is stretched in any direction, it won't scale -- instead,
 * the gap between the hamburger slices will grow.
 */

import { faBars } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface HamburgerProps {
	className?: string;
}

export const Hamburger: React.FC<HamburgerProps> = props => (
	<FontAwesomeIcon {...props} icon={faBars} />
);
