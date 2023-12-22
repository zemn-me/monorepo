import { Metadata } from 'next/types';
import Link from 'project/zemn.me/components/Link';

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
	title: 'Experiments',
	description: 'List of experiments.',
};
