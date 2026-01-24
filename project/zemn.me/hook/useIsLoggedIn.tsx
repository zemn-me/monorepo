import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';

export function useIsLoggedIn(): boolean {
	const [token] = useZemnMeAuth();
	return token(
		() => true,
		() => false,
		() => false
	)
}
