import { Metadata } from '#root/ts/remix/metadata.js';

export const metadata: Metadata = {
	title: 'Anna!',
};

export default function Main() {
	return <p>Anna!</p>;
}

export const handle = { metadata };
