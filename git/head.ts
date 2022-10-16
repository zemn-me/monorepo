import HEAD from 'monorepo/git/head_ref';

/**
 * The HEAD ref of this git monorepo.
 *
 * This is a generated file, and typescript may not be aware of it.
 */
export const ref = HEAD;

export const link =
	`https://github.com/Zemnmez/monorepo/commit/${ref}` as const;
