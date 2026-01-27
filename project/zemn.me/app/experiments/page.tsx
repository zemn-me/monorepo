import { Metadata } from 'next/types';

import Link from '#root/project/zemn.me/components/Link/index.js';

const pages = {
	"/experiments/emoji/flag": "Custom Country flag emoji generator.",
	"/experiments/rays": "Renderer for ray/halo effects.",
	"/experiments/factorio": "Some Factorio experiments.",
	"/experiments/cultist": "Mostly broken cultist simulator game board from the Covid-19 era.",
	"/experiments/geometry_of_music": "Notes from reading the book Geometry of Music.",
	"/experiments/frame": "Calculator for framing and sizing mattes.",
	"/experiments/toc": "Test renderer for table of contents generation.",
	"/experiments/article": "Test renderer for MDX.",
	"/experiments/cv": "Unfinished attempt to port my CV to my modern site.",

}

export function ExperimentsNav() {
	return (
		<nav>
			<ul>
				{Object.entries(pages).map(([path, description]) => (
					<li key={path}>
						<Link href={path}>{description}</Link>
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
