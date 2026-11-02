import { useSessionClaims } from '#root/project/me/zemn/hook/server_session.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

export function useIsLoggedIn(): boolean {
	const [token] = useZemnMeAuth();
	return useSessionClaims(token) !== undefined;
}
