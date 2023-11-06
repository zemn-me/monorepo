import React from 'react';

/**
 * Records how many mounted components depend on the
 * particular class on the <body> element.
 *
 * If it falls to 0, the class is removed.
 */
const classDependents = new Map<string, number>();

const cleanDependents = () => {
	const retirees: string[] = [];
	for (const [className, count] of classDependents) {
		if (count === 0) {
			retirees.push(className);
			document.body.classList.remove(className);
			continue;
		}

		document.body.classList.add(className);
	}

	for (const retiree of retirees) classDependents.delete(retiree);
};

const deltaDependent = (className: string, delta: -1 | 1) => {
	classDependents.set(
		className,
		(classDependents.get(className) ?? 0) + delta
	);
	cleanDependents();
};

export function use(className: string) {
	React.useEffect(() => {
		deltaDependent(className, 1);
		return () => deltaDependent(className, -1);
	}, [className]);
}
