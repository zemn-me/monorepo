import Main from '#root/project/me/zemn/app/experiments/cultist/client.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return <Main />;
}

export const metadata: Metadata = {
	title: 'Cultist simulator experiment',
};
