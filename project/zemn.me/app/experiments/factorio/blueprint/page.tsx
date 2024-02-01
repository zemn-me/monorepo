import Link from 'next/link';

import { Prose } from '#root/project/zemn.me/components/Prose/prose';

export default function Page() {
	return (
		<Prose>
			<h1>Factorio Blueprint Experiments</h1>
			<ul>
				<li>
					<Link href="blueprint/parse">Blueprint parser</Link>
				</li>
				<li>
					<Link href="blueprint/request">
						Blueprint requester chest generator
					</Link>
				</li>
			</ul>
		</Prose>
	);
}
