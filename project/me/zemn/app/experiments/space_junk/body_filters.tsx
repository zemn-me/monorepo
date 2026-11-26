import type { ReactNode } from 'react';
import style from './style.module.css';

export function BodyFilters<T extends string>({
	group,
	children,
	presetName,
	preset,
	options,
	labels,
	glyphs,
	selected,
	onChange,
}: {
	group: string;
	children?: ReactNode;
	presetName: string;
	preset: readonly T[];
	options: readonly T[];
	labels?: Record<T, string>;
	glyphs?: Record<T, string>;
	selected: readonly T[];
	onChange: (selection: T[]) => void;
}) {
	function toggle(items: readonly T[], on: boolean) {
		onChange(
			options.filter(item =>
				items.includes(item) ? on : selected.includes(item)
			)
		);
	}
	function groupSwitch(name: string, items: readonly T[]) {
		const all = items.every(item => selected.includes(item));
		const mixed = !all && items.some(item => selected.includes(item));
		return (
			<label className={style.switch}>
				<span>{name}</span>
				<input
					type="checkbox"
					checked={all}
					ref={el => {
						if (el) el.indeterminate = mixed;
					}}
					onChange={e => toggle(items, e.currentTarget.checked)}
				/>
			</label>
		);
	}
	function optionSwitch(item: T) {
		return (
			<label key={item} className={style.switch}>
				<span className={glyphs ? style.planetName : undefined}>
					{glyphs && (
						<span className={style.toggleGlyph} aria-hidden="true">
							{glyphs[item]}
							{'\uFE0E'}
						</span>
					)}
					{labels?.[item] ?? item}
				</span>
				<input
					type="checkbox"
					role="switch"
					checked={selected.includes(item)}
					onChange={e => toggle([item], e.currentTarget.checked)}
				/>
			</label>
		);
	}
	return (
		<div
			role="group"
			aria-label={group}
			className={glyphs ? style.planetBand : style.objectBand}
		>
			{groupSwitch(group, options)}
			{children}
			<div
				role="group"
				aria-label={presetName}
				className={style.zodiacGroup}
			>
				{groupSwitch(presetName, preset)}
				{preset.map(optionSwitch)}
			</div>
			<div className={style.outerBodies}>
				{options
					.filter(item => !preset.includes(item))
					.map(optionSwitch)}
			</div>
		</div>
	);
}
