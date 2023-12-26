import { Metadata } from 'next/types';

export interface Props {
	readonly children?: React.ReactNode;
}

export default function ExperimentsLayout(props: Props) {
	return <>{props.children}</>;
}

export const metadata: Metadata = {
	title: {
		template: '%s – zemn.me experiments',
		default: 'zemn.me',
	},
};
