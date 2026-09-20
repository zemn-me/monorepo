import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import style from '#root/project/me/zemn/app/journal/processing_status.module.css';
import { JournalStatus } from '#root/project/me/zemn/app/journal/status.js';

export function JournalProcessingStatus({
	progress,
	showSpinner = true,
}: {
	readonly showSpinner?: boolean;
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
			) : showSpinner ? (
				<JournalStatus label={label} />
			) : null}
			<span aria-hidden={showSpinner || (!summarizing && total > 1)}>
				{label}
			</span>
		</span>
	);
}
