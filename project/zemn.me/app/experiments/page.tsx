import { Metadata } from 'next/types';

import Link from '#root/project/zemn.me/components/Link/index.js';

export function ExperimentsNav() {
	return (
		<nav>
			<ul>
				<li>
					<Link href="/experiments/emoji/flag">
						Custom Country flag emoji generator!
					</Link>
				</li>
				<li>
					<Link href="/experiments/rays">halo thingy</Link>
				</li>
				<li>
					<Link href="experiments/factorio">
						Little experimental factorio blueprint parser.
					</Link>
				</li>
			</ul>
		</nav>
	);
}

export default function Main() {
	return (
		<>
			<p>
				Sorry i havent worked out how i want to do navigation yet. so
				this is the best you will get...
			</p>
			<ExperimentsNav />
		</>
	);
}

export const metadata: Metadata = {
	title: 'List of experiments.',
	description: 'List of experiments.',
};
