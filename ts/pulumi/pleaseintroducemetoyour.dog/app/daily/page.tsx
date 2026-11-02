import { DogsOfTheDay } from '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/daily/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <DogsOfTheDay />;
}

export const metadata: Metadata = {
	title: 'dogs of the day!!!',
};

export const handle = { metadata };
