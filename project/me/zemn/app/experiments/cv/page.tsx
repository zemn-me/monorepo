import Redirect from '#root/ts/remix/component/Redirect/app.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <Redirect to="/cv" />;
}

export const metadata: Metadata = {
	description: 'Redirect to my CV.',
};

export const handle = { metadata };
