import styles from '#root/css/module/exact_keys.module.css';

export function acceptsOnlyDeclaredClasses(): string {
	const existing = styles.root;

	// @ts-expect-error CSS module declarations reject classes absent from the source module.
	const missing = styles.missing;

	return existing + missing;
}
