import {
	faCircleExclamation,
	faCloudArrowUp,
	faPause,
	faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';

import style from '#root/project/me/zemn/app/journal/style.module.css';

export function JournalStatus({
	label,
	state = 'busy',
}: {
	readonly label: string;
	readonly state?: 'busy' | 'queued' | 'interrupted' | 'error';
}) {
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

export function JournalProcessingStatus({
	progress,
}: {
	readonly progress?: components['schemas']['JournalProcessingProgress'];
}) {
	const summarizing = progress?.stage === 'summarizing';
	const total = progress?.totalChunks ?? 0;
	const completed = progress?.completedChunks ?? 0;
	const label = summarizing
		? 'Preparing summary'
		: total > 1
			? `Transcribing voice note: ${completed} of ${total} parts`
			: completed > 0 && total === 0
				? `Transcribing voice note: ${completed} ${completed === 1 ? 'part' : 'parts'} complete`
				: 'Transcribing voice note';
	return (
		<span className={style.processingStatus}>
			{!summarizing && total > 1 ? (
				<progress
					aria-label={label}
					role="progressbar"
					max={total}
					value={completed}
					aria-valuemin={0}
					aria-valuemax={total}
					aria-valuenow={completed}
				/>
			) : (
				<JournalStatus label={label} />
			)}
			<span aria-hidden="true">{label}</span>
		</span>
	);
}
