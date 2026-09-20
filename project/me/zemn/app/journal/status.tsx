import {
	faCircleExclamation,
	faCloudArrowUp,
	faPause,
	faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from '#root/project/me/zemn/app/journal/style.module.css';

export function JournalStatus({
	label,
	state = 'busy',
	progress,
}: {
	readonly label: string;
	readonly state?: 'busy' | 'queued' | 'interrupted' | 'error';
	readonly progress?: number;
}) {
	if (progress !== undefined)
		return <JournalProgress label={label} progress={progress} />;
	const icon = {
		busy: faSpinner,
		queued: faCloudArrowUp,
		interrupted: faPause,
		error: faCircleExclamation,
	}[state];
	return (
		<span
			aria-label={label}
			className={style.statusIndicator}
			data-state={state}
			role="status"
			title={label}
		>
			<FontAwesomeIcon aria-hidden="true" icon={icon} />
			<span className={style.visuallyHidden}>{label}</span>
		</span>
	);
}

export function JournalPlaceholder({ label }: { readonly label: string }) {
	return (
		<div aria-label={label} className={style.placeholder} role="status">
			<span className={style.visuallyHidden}>{label}</span>
			<span aria-hidden="true" />
			<span aria-hidden="true" />
			<span aria-hidden="true" />
		</div>
	);
}

export function JournalProgress({
	label,
	progress,
}: {
	readonly label: string;
	readonly progress: number;
}) {
	const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
	return (
		<span
			className={style.progressRing}
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			title={`${label}: ${percent}%`}
		>
			<svg aria-hidden="true" viewBox="0 0 36 36">
				<circle
					className={style.progressTrack}
					cx="18"
					cy="18"
					r="16"
				/>
				<circle
					cx="18"
					cy="18"
					r="16"
					pathLength="100"
					strokeDasharray={`${percent} 100`}
					transform="rotate(-90 18 18)"
				/>
			</svg>
		</span>
	);
}
