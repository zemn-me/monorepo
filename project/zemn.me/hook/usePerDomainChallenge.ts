import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocalSecret } from "#root/project/zemn.me/hook/useLocalSecret.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { Hour } from "#root/ts/time/duration.js";

function challengeKey(domain: string) {
	return ["challenge", domain] as const;
}

export function useInvalidateChallenge(domain: string) {
	const queryClient = useQueryClient();
	return () => void queryClient.invalidateQueries({
		queryKey: challengeKey(domain)
	})
}

export function useChallenge(domain: string) {
	return useQuery({
		queryKey: challengeKey(domain),
		queryFn: async () => {
			const arr = new Uint8Array(1024/8);
			crypto.getRandomValues(arr);
			return arr;
		},
		staleTime: 5 * Hour,
	})
}

async function sha256Bytes(s: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function timingSafeEqualStringDigest(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  return timingSafeEqualBytes(da, db);
}


/**
 * Validate a challenge. Doing so will also invalidate the challenge,
 * if correct!
 */
export function useValidateChallenge(candidate: string, domain: string) {
	const challenge = useChallenge(domain);
	const invalidate = useInvalidateChallenge(domain);


	// why is it such a fucking pain to do a fixed-time string comparison
	// on the web
}
