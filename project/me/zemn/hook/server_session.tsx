import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from 'react';
import type { z } from 'zod';
import type { Future } from '#root/ts/future/future.js';
import type { OidcIdTokenClaimsSchema } from '#root/ts/oidc/id_token.js';
import { watchOutParseIdToken } from '#root/ts/oidc/oidc.js';

type OidcIdTokenClaims = z.infer<typeof OidcIdTokenClaimsSchema>;

export interface ServerSession {
	readonly claims: OidcIdTokenClaims;
	readonly scopes: string[];
}

const ServerSessionContext = createContext<{
	readonly session: ServerSession | null;
	readonly clear: () => void;
}>({ session: null, clear: () => undefined });

export function ServerSessionProvider({
	session,
	children,
}: {
	readonly session: ServerSession | null;
	readonly children: ReactNode;
}) {
	// A router revalidation must not resurrect the page's pre-logout identity.
	const [revoked, setRevoked] = useState(false);
	useEffect(() => {
		if (!session) return;
		let timeout: ReturnType<typeof setTimeout>;
		const checkExpiry = () => {
			const remaining = session.claims.exp * 1000 - Date.now();
			if (remaining <= 0) setRevoked(true);
			else
				timeout = setTimeout(
					checkExpiry,
					Math.min(remaining, 2 ** 31 - 1)
				);
		};
		checkExpiry();
		return () => clearTimeout(timeout);
	}, [session]);
	return (
		<ServerSessionContext.Provider
			value={{
				session: revoked ? null : session,
				clear: () => setRevoked(true),
			}}
		>
			{children}
		</ServerSessionContext.Provider>
	);
}

export const useServerSession = () => useContext(ServerSessionContext);

export function useSessionClaims<A, B>(token: Future<string, A, B>) {
	const { session } = useServerSession();
	return token(
		value => {
			const parsed = watchOutParseIdToken.safeParse(value);
			return parsed.success ? parsed.data : undefined;
		},
		() => session?.claims,
		() => undefined
	);
}
