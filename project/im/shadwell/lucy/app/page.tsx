import { Metadata } from '#root/ts/remix/metadata.js';

export const metadata: Metadata = {
	title: 'Lucy',
};

export default function Main() {
	return <p>Hi this is Lucy!</p>;
}

export const handle = { metadata };
