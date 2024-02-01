import { Metadata } from 'next/types';

import Link from '#root/project/zemn.me/components/Link/index.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';

export default function Main() {
	return (
		<Prose>
			<h1>Factorio experiments</h1>
			<dl>
				<dt>
					<Link href="factorio/blueprint">Blueprint experiments</Link>
				</dt>
				<dd>Playing around with the Factorio blueprint format.</dd>
			</dl>
		</Prose>
	);
}

export const metadata: Metadata = {
	title: 'List of experiments.',
	description: 'List of experiments.',
};
