import { Metadata } from 'next/types';

import ThreeDClient from '#root/project/zemn.me/app/experiments/3d/client.js';



export default function Page() {
	return <ThreeDClient/>
}

export const metadata: Metadata = {
	title: "test 3d renderer"
}


