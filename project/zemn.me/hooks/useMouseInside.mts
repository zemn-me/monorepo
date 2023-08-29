import React from 'react';

/**
 * useMouseInside is a hook that returns a single value,
 * indicating if the pointing device is inside a set of element
 * boundaries.
 */
export const useMouseInside = ({
	gracePeriodOff = 100,
	gracePeriodOn = 0,
}: {
	gracePeriodOn?: number;
	gracePeriodOff?: number;
} = {}) => {
	// if we used proper state here, we might not reset
	// the timer at some point.
	const gracePeriodTimer = React.useRef<
		ReturnType<typeof setTimeout> | undefined
	>();

	const [isInside, setIsInside] = React.useState<boolean | undefined>(
		undefined
	);

	const onMouseOver = React.useCallback(() => {
		if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
		gracePeriodTimer.current = setTimeout(
			() => setIsInside(() => true),
			gracePeriodOn
		);
	}, [setIsInside, gracePeriodTimer, gracePeriodOn]);

	const onMouseLeave = React.useCallback(() => {
		if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
		gracePeriodTimer.current = setTimeout(
			() => setIsInside(() => false),
			gracePeriodOff
		);
	}, [gracePeriodTimer, setIsInside, gracePeriodOff]);

	return [isInside, onMouseOver, onMouseLeave] as const;
};

export default useMouseInside;
