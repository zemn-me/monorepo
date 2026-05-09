import Link from '#root/project/me/zemn/components/Link/index.js';
import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import { Metadata } from '#root/ts/remix/index.js';

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
