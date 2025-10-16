import { useQuery } from "@tanstack/react-query";


export function useLocalSecret() {
	return useQuery({
		queryKey: ['local_secret'],
		staleTime: Infinity,
		queryFn: () => {
			const bytes = new Uint8Array(128);
			crypto.getRandomValues(bytes);

			return bytes;
		}
	})
}
