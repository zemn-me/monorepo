import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { JournalStatus } from '#root/project/me/zemn/app/journal/status.js';

export function JournalProcessingStatus({
	progress,
}: {
	readonly progress?: components['schemas']['JournalProcessingProgress'];
}) {
	const summarizing = progress?.stage === 'summarizing';
	const total = progress?.totalChunks ?? 0;
	return (
		<JournalStatus
			label={summarizing ? 'Preparing summary' : 'Transcribing voice note'}
			progress={
				!summarizing && total > 0
					? (progress?.completedChunks ?? 0) / total
					: undefined
			}
		/>
	);
}
