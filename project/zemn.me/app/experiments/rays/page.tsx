import { Metadata } from 'next/types';
import RaysEditor from '#//project/zemn.me/app/experiments/rays/component';

export default function Page() {
	return <RaysEditor />;
}

export const metadata: Metadata = {
	title: 'Rays',
	description: 'Mess around with engraving style rays.',
};
