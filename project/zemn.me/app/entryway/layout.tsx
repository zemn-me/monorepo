'use client';
import { useQueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { ReactNode, useState } from 'react';
import superjson from 'superjson';

import { api } from '#root/project/entryway/api/client/client.js';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	const rqc = useQueryClient();
	const [trpcClient] = useState(() =>
		api.createClient({
			links: [
				httpBatchLink({
					url: 'http://localhost:3000/trpc',
					// You can pass any HTTP headers you wish here
				}),
			],
			transformer: superjson,
		})
	);
	return (
		<api.Provider client={trpcClient} queryClient={rqc}>
			{children}
		</api.Provider>
	);
}
