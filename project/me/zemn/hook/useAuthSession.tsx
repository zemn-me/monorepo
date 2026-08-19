import { useQueryClient } from '@tanstack/react-query';
import {
	createContext,
	type ReactNode,
	useContext,
	useRef,
	useState,
} from 'react';

export const OIDC_ID_TOKEN_HINT_STORAGE_KEY = 'zemn-me-oidc-id-token-hint';

interface AuthSessionContextValue {
	readonly generation: number;
	/**
	 * Ends the active application session and returns the generation that the
	 * next authentication response should populate. A string replaces the
	 * ordinary-login hint, null clears it, and undefined preserves any existing
	 * hint.
	 */
	readonly endSession: (idTokenHint?: string | null) => number;
}

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
	undefined
);

export interface AuthSessionProviderProps {
	readonly children?: ReactNode;
	readonly clearPersistedClient: () => Promise<void>;
}

export function AuthSessionProvider({
	children,
	clearPersistedClient,
}: AuthSessionProviderProps) {
	const queryClient = useQueryClient();
	const [generation, setGeneration] = useState(0);
	const generationRef = useRef(generation);

	const endSession = (idTokenHint?: string | null) => {
		if (idTokenHint === null) {
			localStorage.removeItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY);
		} else if (idTokenHint !== undefined) {
			localStorage.setItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY, idTokenHint);
		}

		// Clearing is synchronous, so a switch-user popup can still be opened
		// directly from the originating click without retaining the old session.
		void queryClient.cancelQueries();
		queryClient.clear();
		void clearPersistedClient();

		generationRef.current += 1;
		setGeneration(generationRef.current);
		return generationRef.current;
	};

	return (
		<AuthSessionContext.Provider value={{ endSession, generation }}>
			{children}
		</AuthSessionContext.Provider>
	);
}

export function getOIDCIdTokenHint() {
	return localStorage.getItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY) ?? undefined;
}

export function useAuthSession() {
	const value = useContext(AuthSessionContext);
	if (value === undefined) {
		throw new Error('useAuthSession requires AuthSessionProvider');
	}
	return value;
}
