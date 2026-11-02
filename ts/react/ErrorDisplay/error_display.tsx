export interface Props {
	readonly error: unknown;
}

/**
 * Display an Error type neatly. Or don't. It's up to you.
 */
export function ErrorDisplay({ error }: Props) {
	if (!(error instanceof Error)) {
		return <>`Unknown error: ${error}`</>;
	}

	return (
		<figure>
			<figcaption>
				{error.name}: {error.message}
			</figcaption>
			{error.cause ? (
				<ol>
					<li>
						<ErrorDisplay error={error.cause} />
					</li>
				</ol>
			) : null}
		</figure>
	);
}
