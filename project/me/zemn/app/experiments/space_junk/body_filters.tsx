import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState } from 'react';
import style from './style.module.css';

export function BodyFilters<T extends string>({
	group,
	layer,
	presetName,
	preset,
	options,
	labels,
	selected,
	onChange,
}: {
	group: string;
	layer?: { enabled: boolean; onChange: (enabled: boolean) => void };
	presetName: string;
	preset: readonly T[];
	options: readonly T[];
	labels?: Record<T, string>;
	selected: readonly T[];
	onChange: (selection: T[]) => void;
}) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const all = preset.every(item => selected.includes(item));
	const mixed = !all && preset.some(item => selected.includes(item));
	function toggle(items: readonly T[], on: boolean) {
		onChange(
			options.filter(item =>
				items.includes(item) ? on : selected.includes(item)
			)
		);
	}
	const presetSwitch = (
		<label className={style.switch}>
			<input
				type="checkbox"
				checked={all}
				disabled={layer?.enabled === false}
				ref={el => {
					if (el) el.indeterminate = mixed;
				}}
				onChange={e => toggle(preset, e.currentTarget.checked)}
			/>
			{presetName}
		</label>
	);
	function optionSwitch(item: T) {
		return (
			<label key={item} className={style.switch}>
				<input
					type="checkbox"
					role="switch"
					checked={selected.includes(item)}
					disabled={layer?.enabled === false}
					onChange={e => toggle([item], e.currentTarget.checked)}
				/>
				{labels?.[item] ?? item}
			</label>
		);
	}
	if (layer)
		return (
			<div role="group" aria-label={group} className={style.planetBand}>
				<label className={style.switch}>
					<input
						type="checkbox"
						role="switch"
						checked={layer.enabled}
						onChange={e => layer.onChange(e.currentTarget.checked)}
					/>
					<span>{group}</span>
				</label>
				<div
					role="group"
					aria-label={presetName}
					className={style.zodiacGroup}
				>
					{presetSwitch}
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
				{presetSwitch}
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
