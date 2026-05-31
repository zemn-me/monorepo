import { Metadata } from 'next/types';

import Link from '#root/project/me/zemn/components/Link/index.js';
import { experimentLinks } from '#root/project/me/zemn/navigation/navigation.js';

const pages = experimentLinks.filter(link => link.href !== '/experiments');

export function ExperimentsNav() {
	return (
		<nav>
			<ul>
				{pages.map(link => (
					<li key={link.href}>
						<Link href={link.href}>
							{link.description ?? link.label}
						</Link>
					</li>
				))}
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
