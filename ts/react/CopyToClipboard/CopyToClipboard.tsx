'use client';
import { useMutation } from '@tanstack/react-query';
import { MouseEvent, useCallback } from 'react';

export interface CopyToClipboardProps {
	readonly text: string;
}

export function CopyToClipboard(props: CopyToClipboardProps) {
	const mutation = useMutation({
		mutationFn: () => navigator.clipboard.writeText(props.text),
	});

	const onClick = useCallback(
		(e: MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			if (mutation.isLoading) return;
			mutation.mutate();
		},
		[mutation]
	);
	return (
		<button
			{...(mutation.isLoading ? { disabled: true } : {})}
			onClick={onClick}
		>
			{'Copy to clipboard' +
				{
					idle: '.',
					loading: '...',
					error: '..❌',
					success: '..✅',
				}[mutation.status]}
		</button>
	);
}
