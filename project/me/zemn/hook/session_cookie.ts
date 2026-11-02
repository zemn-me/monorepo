// Serialize writes: an in-flight login must finish before logout deletes its cookie.
// Do not abort the fetch itself: browsers can apply Set-Cookie after cancellation.
let writes: Promise<unknown> = Promise.resolve();
export function updateSessionCookie(
	token: string | null,
	signal?: AbortSignal
) {
	const next = writes
		.catch(() => undefined)
		.then(async () => {
			signal?.throwIfAborted();
			const response = await fetch('/auth/session', {
				method: token === null ? 'DELETE' : 'POST',
				credentials: 'same-origin',
				headers: token === null ? undefined : { Authorization: token },
			});
			if (!response.ok)
				throw new Error(
					'Could not update your login. Please try again.'
				);
			return true;
		});
	writes = next;
	return next;
}
