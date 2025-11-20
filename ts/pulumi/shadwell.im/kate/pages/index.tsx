import Head from 'next/head';

import styles from './index.module.css';

const trees = [
	{
		name: 'English oak',
		description: 'Broad, sturdy crown with lobed leaves and acorns that feed wildlife.',
	},
	{
		name: 'Silver birch',
		description: 'Pale peeling bark and a light canopy that lets wildflowers thrive below.',
	},
	{
		name: 'Scots pine',
		description: 'Tall evergreen with orange plates of bark near the crown and blue-green needles.',
	},
	{
		name: 'Rowan (mountain ash)',
		description: 'Feathery leaflets and bright red autumn berries loved by birds.',
	},
	{
		name: 'Field maple',
		description: 'Small maple with rounded lobed leaves that turn golden in autumn.',
	},
	{
		name: 'Hazel',
		description: 'Multi-stemmed coppice tree with spring catkins and sweet nuts.',
	},
	{
		name: 'Hedgerow mix',
		description: 'Hawthorn, blackthorn, and dog rose weaving wildlife corridors with blossom, hips, and sloes.',
	},
	{
		name: 'Wild cherry',
		description: 'Clouds of white blossom in spring and glossy red cherries later in the year.',
	},
	{
		name: 'Aspen',
		description: 'Heart-shaped leaves that shimmer and flutter with the lightest breeze.',
	},
];

export default function Main() {
	return (
		<>
			<Head>
				<title>Kate&apos;s art</title>
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
				<link
					href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap"
					rel="stylesheet"
				/>
				<style
					dangerouslySetInnerHTML={{
						__html: `
						:root { color-scheme: light; }
						body {
							margin: 0;
							font-family: 'Manrope', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
							background:
								radial-gradient(circle at 20% 20%, #f1f3ff 0, transparent 30%),
								radial-gradient(circle at 80% 0%, #e6fff3 0, transparent 28%),
								linear-gradient(135deg, #fdfbff 0%, #f6fff9 100%);
							color: #17212a;
						}
					`,
					}}
				/>
			</Head>
			<div className={styles.page}>
				<div aria-hidden className={styles.accent} />
				<div className={styles.card}>
					<header className={styles.header}>
						<p className={styles.eyebrow}>Kate&apos;s art</p>
						<h1 className={styles.title}>Native trees of the UK</h1>
						<p className={styles.lede}>
							A handful of well-loved species, each with a little character note to enjoy.
						</p>
					</header>
					<ul className={styles.grid}>
						{trees.map(tree => (
							<li className={styles.tile} key={tree.name}>
								<div className={styles.tileName}>{tree.name}</div>
								<p className={styles.tileCopy}>{tree.description}</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</>
	);
}
