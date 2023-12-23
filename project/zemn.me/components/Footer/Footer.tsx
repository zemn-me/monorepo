import classNames from 'classnames';
import { dividerHeadingClass } from 'project/zemn.me/components/DividerHeading';
import style from 'project/zemn.me/components/Footer/footer.module.css';
import ZemnmezLogo from 'project/zemn.me/components/ZemnmezLogo';
import { FC } from 'react';

export interface Props {
	readonly className?: string;
}

export const Footer: FC = function Footer(props: Props) {
	return (
		<footer className={classNames(style.footer, props.className)}>
			<h2 className={dividerHeadingClass}>
				<span>⁂</span>
			</h2>
			<ZemnmezLogo className={style.future} />
			<i className={style.tagline}>
				This is what we become, when our eyes are open.
			</i>
		</footer>
	);
};
