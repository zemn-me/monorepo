'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback } from 'react';

import style from '#root/project/me/zemn/app/experiments/cv/page.module.css';

const cvModes = ['short', 'long'] as const;
type CVMode = (typeof cvModes)[number];

const cvModeParser = parseAsStringLiteral(cvModes)
	.withOptions({ clearOnDefault: true })
	.withDefault('long');

export function ModeSwitch() {
	const [mode, setMode] = useQueryState('mode', cvModeParser);
	const selectShort = useCallback(() => {
		void setMode('short');
	}, [setMode]);
	const selectLong = useCallback(() => {
		void setMode('long');
	}, [setMode]);

	return (
		<nav
			aria-label="CV length"
			className={style.modeSwitch}
			data-mode={mode}
		>
			<ModeButton
				isSelected={mode === 'short'}
				mode="short"
				onSelect={selectShort}
			/>
			<ModeButton
				isSelected={mode === 'long'}
				mode="long"
				onSelect={selectLong}
			/>
		</nav>
	);
}

function ModeButton({
	isSelected,
	mode,
	onSelect,
}: {
	readonly isSelected: boolean;
	readonly mode: CVMode;
	readonly onSelect: () => void;
}) {
	return (
		<button
			aria-pressed={isSelected}
			className={style.modeButton}
			onClick={onSelect}
			type="button"
		>
			{mode}
		</button>
	);
}
