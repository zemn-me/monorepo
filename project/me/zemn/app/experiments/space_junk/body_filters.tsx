import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState } from 'react';
import style from './style.module.css';

export function BodyFilters<T extends string>({
	group,
	grouped,
	presetName,
	preset,
	options,
	labels,
	selected,
	onChange,
}: {
	group: string;
	grouped?: boolean;
	presetName: string;
	preset: readonly T[];
	options: readonly T[];
	labels?: Record<T, string>;
	selected: readonly T[];
	onChange: (selection: T[]) => void;
}) {
	const [open, setOpen] = useState(false);
	const id = useId();
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
				<input
					type="checkbox"
					checked={all}
					ref={el => {
						if (el) el.indeterminate = mixed;
					}}
					onChange={e => toggle(items, e.currentTarget.checked)}
				/>
				{name}
			</label>
		);
	}
	function optionSwitch(item: T) {
		return (
			<label key={item} className={style.switch}>
				<input
					type="checkbox"
					role="switch"
					checked={selected.includes(item)}
					onChange={e => toggle([item], e.currentTarget.checked)}
				/>
				{labels?.[item] ?? item}
			</label>
		);
	}
	if (grouped)
		return (
			<div role="group" aria-label={group} className={style.planetBand}>
				{groupSwitch(group, options)}
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
	return (
		<div role="group" aria-label={group} className={style.filterGroup}>
			<div className={style.filterHeading}>
				{groupSwitch(presetName, preset)}
				<button
					type="button"
					aria-label={'Choose ' + group.toLowerCase()}
					aria-expanded={open}
					aria-controls={id}
					onClick={() => setOpen(!open)}
				>
					<FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
				</button>
			</div>
			<div id={id} hidden={!open}>
				<div className={style.filterOptions}>
					{options.map(optionSwitch)}
				</div>
			</div>
		</div>
	);
}
