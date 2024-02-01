import Link from 'next/link';

import { Prose } from '#root/project/zemn.me/components/Prose/prose';

export default function Page() {
	return (
		<Prose>
			<h1>Factorio Blueprint Experiments</h1>
			<ul>
				<li>
					<Link href="factorio/parse">Blueprint parser</Link>
				</li>
				<li>
					<Link href="factorio/request">
						Blueprint requester chest generator
					</Link>
				</li>
			</ul>
		</Prose>
	);
}
