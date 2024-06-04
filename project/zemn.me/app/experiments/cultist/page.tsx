import { Metadata } from 'next/types';

import Main from '#root/project/zemn.me/app/experiments/cultist/client.js';

export default function Page() {
	return <Main />;
}

export const metadata: Metadata = {
	title: 'Cultist simulator experiment',
};
