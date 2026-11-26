import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState } from 'react';
import style from './style.module.css';

export function BodyFilters<T extends string>({
	group,
	presetName,
	preset,
	options,
	labels,
	selected,
	onChange,
}: {
	group: string;
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
	return (
		<fieldset className={style.filterGroup}>
			<legend>{group}</legend>
			<div className={style.filterHeading}>
				<label className={style.switch}>
					<input
						type="checkbox"
						checked={all}
						ref={el => {
							if (el) el.indeterminate = mixed;
						}}
						onChange={e => toggle(preset, e.currentTarget.checked)}
					/>
					{presetName}
				</label>
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
					{options.map(item => (
						<label key={item} className={style.switch}>
							<input
								type="checkbox"
								role="switch"
								checked={selected.includes(item)}
								onChange={e =>
									toggle([item], e.currentTarget.checked)
								}
							/>
							{labels?.[item] ?? item}
						</label>
					))}
				</div>
			</div>
		</fieldset>
	);
}
