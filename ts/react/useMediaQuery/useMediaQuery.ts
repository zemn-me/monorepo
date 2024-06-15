'use client';
import { useEffect, useState } from "react"


export function useMediaQuery(mediaQuery: string | undefined) {
	const query = mediaQuery ? matchMedia(mediaQuery) : undefined;
	const [result, setResult] = useState<boolean | undefined>(
		query?.matches
	);


	useEffect(() => {
		query?.addEventListener('change', e => setResult(e.matches));
	}, [query, setResult]);


	return result;
}
