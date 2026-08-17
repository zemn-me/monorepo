import { Metadata } from 'next/types';

import { DogsOfTheDay } from '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/daily/client.js';

export default function Page() {
	return <DogsOfTheDay />;
}

export const metadata: Metadata = {
	title: 'dogs of the day!!!',
};
