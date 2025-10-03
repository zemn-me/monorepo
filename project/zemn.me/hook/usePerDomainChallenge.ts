import { useLocalSecret } from "#root/project/zemn.me/hook/useLocalSecret.js";


export function usePerDomainChallenge(domain: string) {
	const secret = useLocalSecret();


}
