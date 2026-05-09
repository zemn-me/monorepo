import { Metadata } from '#root/ts/remix/index.js';

import styles from './page.module.css';

export const metadata: Metadata = {
	title: "Kate's art",
};

const trees = [
	{
		name: 'English oak',
		description:
			'Broad, sturdy crown with lobed leaves and acorns that feed wildlife.',
	},
	{
		name: 'Silver birch',
		description:
			'Pale peeling bark and a light canopy that lets wildflowers thrive below.',
	},
	{
		name: 'Scots pine',
		description:
			'Tall evergreen with orange plates of bark near the crown and blue-green needles.',
	},
	{
		name: 'Rowan (mountain ash)',
		description:
			'Feathery leaflets and bright red autumn berries loved by birds.',
	},
	{
		name: 'Field maple',
		description:
			'Small maple with rounded lobed leaves that turn golden in autumn.',
	},
	{
		name: 'Hazel',
		description:
			'Multi-stemmed coppice tree with spring catkins and sweet nuts.',
	},
	{
		name: 'Hedgerow mix',
		description:
			'Hawthorn, blackthorn, and dog rose weaving wildlife corridors with blossom, hips, and sloes.',
	},
	{
		name: 'Wild cherry',
		description:
			'Clouds of white blossom in spring and glossy red cherries later in the year.',
	},
	{
		name: 'Aspen',
		description:
			'Heart-shaped leaves that shimmer and flutter with the lightest breeze.',
	},
];

export default function Main() {
	return (
		<div className={styles.page}>
			<div aria-hidden className={styles.accent} />
			<div className={styles.card}>
				<header className={styles.header}>
					<p className={styles.eyebrow}>Kate&apos;s art</p>
					<h1 className={styles.title}>Native trees of the UK</h1>
					<p className={styles.lede}>
						A handful of well-loved species, each with a little
						character note to enjoy.
					</p>
				</header>
				<ul className={styles.grid}>
					{trees.map(tree => (
						<li className={styles.tile} key={tree.name}>
							<div className={styles.tileName}>{tree.name}</div>
							<p className={styles.tileCopy}>
								{tree.description}
							</p>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
