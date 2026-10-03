import { createContext, useContext, useState } from 'react';

export const JournalRenderTime = createContext<number | undefined>(undefined);

// Empty-journal navigation must use the same instant on the server and browser.
export function useJournalRenderTime() {
	const initial = useContext(JournalRenderTime);
	return useState(() => initial ?? Date.now())[0];
}
