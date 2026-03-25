export type RankImageRule = {
	readonly rankMatch: RegExp;
	readonly branchMatch?: RegExp;
	readonly src: string;
};

const BRITISH_ARMY_BRANCH = /\bbritish Army\b/i;

const BRITISH_ARMY_RANK_IMAGE_RULES: readonly RankImageRule[] = [
	{
		rankMatch: /\bcaptain\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/UK_Army_OF2.png',
	},
	{
		rankMatch: /\bmajor\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/UK_Army_OF3.png',
	},
	{
		rankMatch: /\blieutenant colonel\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/UK_Army_OF4.png',
	},
	{
		rankMatch: /\bcolonel\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/3/38/UK_Army_OF5.png',
	},
	{
		rankMatch: /\bbrigadier\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/UK_Army_OF6.png',
	},
	{
		rankMatch: /\bmajor general\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/2/24/UK_Army_OF7.png',
	},
	{
		rankMatch: /\blieutenant general\b/i,
		branchMatch: BRITISH_ARMY_BRANCH,
		src: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/UK_Army_OF8.png',
	},
];

export const RANK_IMAGE_RULES: readonly RankImageRule[] = BRITISH_ARMY_RANK_IMAGE_RULES;
