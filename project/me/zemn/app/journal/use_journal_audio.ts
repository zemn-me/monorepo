import { useLayoutEffect, useRef } from 'react';

export function useJournalAudio(capturing: boolean) {
	const ref = useRef<HTMLAudioElement>(null);
	useLayoutEffect(() => {
		const audio = ref.current;
		const { audioSession } = navigator as Navigator & {
			readonly audioSession?: { type: string };
		};
		if (!audio || !audioSession) return;

		// The microphone needs a recording-capable session. Keep diary output
		// muted until the ambient session can honor the silent switch again.
		if (capturing) {
			audio.muted = true;
			return;
		}

		const previousType = audioSession.type;
		audioSession.type = 'ambient';
		audio.muted = false;
		return () => {
			audio.muted = true;
			if (audioSession.type === 'ambient')
				audioSession.type = previousType;
		};
	}, [capturing]);
	return ref;
}
