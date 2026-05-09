import RaysEditor from '#root/project/me/zemn/app/experiments/rays/component.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return <RaysEditor />;
}

export const metadata: Metadata = {
	title: 'Rays',
	description: 'Mess around with engraving style rays.',
};
