import style from 'project/zemn.me/next/components/Prose/prose.module.css';

type DivAttributes = JSX.IntrinsicElements['div'];

export interface Props extends DivAttributes {
	readonly children?: React.ReactElement[];
}

/**
 * Sets up appropriate padding for showing a bunch of paragraphs.
 */
export function Prose({ children, ...props }: Props) {
	return (
		<div {...props} className={style.prose}>
			{children}
		</div>
	);
}
