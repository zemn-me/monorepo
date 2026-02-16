import { Metadata } from 'next/types';

import Main from '#root/project/me/zemn/app/experiments/emoji/flag/component.js';

export default function Page() {
	return <Main />;
}

export const metadata: Metadata = {
	title: 'Custom Country flag emoji generator!',
	description: 'Mess around with emoji flags.',
};
