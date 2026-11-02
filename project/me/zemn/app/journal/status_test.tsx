import { afterEach, expect, it, jest } from '@jest/globals';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.unstable_mockModule('./style.module.css', () => ({ default: {} }));
const { JournalProcessingStatus } = await import('./processing_status.js');

let root: Root | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
});
async function render(node: ReactNode) {
	const container = document.createElement('div');
	root = createRoot(container);
	await act(async () => root?.render(node));
	return container;
}

it('shows real completed chunk progress', async () => {
	const container = await render(
		<JournalProcessingStatus
			progress={{
				stage: 'transcribing',
				completedChunks: 2,
				totalChunks: 4,
			}}
		/>
	);
	expect(
		container
			.querySelector('[role="progressbar"]')
			?.getAttribute('aria-valuenow')
	).toBe('50');
	expect(container.querySelector('[role="progressbar"] svg')).not.toBeNull();
	expect(container.querySelector('[role="status"]')).toBeNull();
	expect(
		container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')
	).toBe('Transcribing voice note');
	expect(container.textContent).toBe('');
});
it('uses compact activity without a guessed denominator while decoding', async () => {
	const container = await render(
		<JournalProcessingStatus
			progress={{
				stage: 'transcribing',
				completedChunks: 2,
				totalChunks: 0,
			}}
		/>
	);
	expect(container.querySelector('[role="progressbar"]')).toBeNull();
	expect(
		container.querySelector('[role="status"]')?.getAttribute('aria-label')
	).toBe('Transcribing voice note');
});
it('switches to summary generation after transcription', async () => {
	const container = await render(
		<JournalProcessingStatus
			progress={{
				stage: 'summarizing',
				completedChunks: 4,
				totalChunks: 4,
			}}
		/>
	);
	expect(container.querySelector('[role="progressbar"]')).toBeNull();
	expect(container.textContent).toContain('Preparing summary');
});
