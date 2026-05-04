
import classNames from "classnames";

import style from '#root/project/zemn.me/components/ChipInput/style.module.css';

export interface ChipInputProps {
	readonly validator?: (chip: string) => boolean;
	readonly split: (input: string) => string[];
	readonly join: (input: string[]) => string;
	readonly onChange: (input: string) => void;
	readonly value: string;
}

/**
 * An input for a set of space-delimited "chips".
 */
export function ChipInput(
	{ validator, split, join, onChange, value}: ChipInputProps
) {
	const chips = split(value);

	const completedChips = chips.slice(0, -1);
	const lastChip = chips[chips.length - 1] || '';

	return <div className={style.chipInput}>
		{completedChips.map((chip, i) => <div className={
				classNames(
					style.chip,
					validator && !validator(chip) ? style.invalid : undefined
				)
			} key={i}>
				{chip}
			</div>)}
		<input onChange={e =>
			onChange(join([...completedChips, e.target.value]))
		} type="text" value={lastChip}/>
	</div>
}
