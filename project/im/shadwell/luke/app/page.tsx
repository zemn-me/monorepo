const linkedInUrl =
	'https://www.linkedin.com/in/lukeshadwell/?originalSubdomain=uk';

export default function Page() {
	return (
		<main>
			<meta content={`0; url=${linkedInUrl}`} httpEquiv="refresh" />
			<p>
				Redirecting to{' '}
				<a href={linkedInUrl}>Luke Shadwell on LinkedIn</a>.
			</p>
		</main>
	);
}
