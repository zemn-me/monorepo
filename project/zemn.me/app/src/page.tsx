import { Metadata } from 'next/types';
import Redirect from 'ts/next.js/component/Redirect/app';

export default function Page() {
	return <Redirect to="https://github.com/zemn-me/monorepo" />;
}

export const metadata: Metadata = {
	description: 'Redirect to the source code.',
};
