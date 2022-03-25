import useClickedOff from 'project/zemn.me/hooks/useClickedOff';
import useMouseInside from 'project/zemn.me/hooks/useMouseInside';
import React from 'react';

/**
 * useHoverMenu provides functionality similar to a hover menu,
 * for both touch devices and pointer devices.
 *
 * - On touch devices, touching a toggle button causes the menu to open and close.
 * - On pointer devices, hovering over either the button or the menu causes it to open
 *   and stay open until hovering stops.
 */
export const useHoverMenu = (menuRef: Node | null) => {
	const [menuOpen, setMenuOpen] = React.useState(false);

	const onClickedOffHandler = React.useCallback(() => {
		setMenuOpen(() => false);
	}, [setMenuOpen]);

	useClickedOff(menuRef, menuOpen ? onClickedOffHandler : null);

	const [isInside, onMouseOver, onMouseLeave] = useMouseInside();

	const onToggleIconClick = React.useCallback(
		() => setMenuOpen(v => !v),
		[setMenuOpen]
	);

	React.useEffect(() => {
		if (isInside !== undefined) setMenuOpen(() => isInside);
	}, [isInside, setMenuOpen]);

	return [
		menuOpen,
		setMenuOpen,
		onMouseOver,
		onMouseLeave,
		onToggleIconClick,
	] as const;
};

export default useHoverMenu;
