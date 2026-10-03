import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

export function useIsLoggedIn(): boolean {
	const [token] = useZemnMeAuth();
	return token(
		() => true,
		() => false,
		() => false
	);
}
