export interface Experiment {
	readonly description: string;
	readonly href: string;
	readonly title: string;
}

export interface ExperimentGroup {
	readonly experiments: readonly Experiment[];
	readonly title: string;
}

export const experimentGroups: readonly ExperimentGroup[] = [
	{
		title: 'Visual studies',
		experiments: [
			{
				href: '/experiments/rays',
				title: 'Rays',
				description: 'Renderer for engraving-style rays and halo effects.',
			},
			{
				href: '/experiments/arena',
				title: 'SVG Arena',
				description: 'FPS-style SVG arena with a pointer-lock camera.',
			},
			{
				href: '/experiments/platonics',
				title: 'Platonic Stress',
				description: 'A dense field of animated SVG platonic solids.',
			},
			{
				href: '/experiments/geometry_of_music',
				title: 'Geometry of Music',
				description: 'Notes and diagrams from reading Geometry of Music.',
			},
		],
	},
	{
		title: 'Generators & tools',
		experiments: [
			{
				href: '/experiments/elastictabs',
				title: 'Elastic Tabstops',
				description: 'Align tab-delimited text into elastic columns.',
			},
			{
				href: '/experiments/emoji/flag',
				title: 'Flag emoji',
				description: 'Custom country flag emoji generator.',
			},
			{
				href: '/experiments/frame',
				title: 'Framing calculator',
				description: 'Calculations for framing pictures and sizing mattes.',
			},
			{
				href: '/experiments/pitch_training',
				title: 'Pitch Training',
				description: 'Generated Anki decks for recognizing pitches by ear.',
			},
		],
	},
	{
		title: 'Factorio',
		experiments: [
			{
				href: '/experiments/factorio',
				title: 'Factorio',
				description: 'An index of experiments with Factorio data.',
			},
			{
				href: '/experiments/factorio/blueprint',
				title: 'Factorio blueprints',
				description: 'Playing around with the Factorio blueprint format.',
			},
			{
				href: '/experiments/factorio/blueprint/parse',
				title: 'Blueprint parser',
				description: 'Inspect the contents of a blueprint string.',
			},
			{
				href: '/experiments/factorio/blueprint/request',
				title: 'Requester chest generator',
				description: 'Generate requester-chest blueprints from item lists.',
			},
			{
				href: '/experiments/factorio/blueprint/wall',
				title: 'Blueprint wall generator',
				description: 'Add a wall around blueprint entities and tiles.',
			},
			{
				href: '/experiments/factorio/blueprint/book',
				title: 'Blueprint book',
				description: 'A collection of blueprints I like or made.',
			},
		],
	},
	{
		title: 'Games',
		experiments: [
			{
				href: '/experiments/cultist',
				title: 'Cultist simulator',
				description:
					'A mostly broken cultist game board from the Covid-19 era.',
			},
		],
	},
];

export const experiments: readonly Experiment[] = experimentGroups.flatMap(
	group => group.experiments
);
