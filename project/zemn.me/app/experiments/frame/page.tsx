import { Metadata } from "next/types";
import { Suspense } from "react";

import { FrameClient } from "#root/project/zemn.me/app/experiments/frame/client.js";


export default function Page() {
	return (
		<Suspense fallback={null}>
			<FrameClient/>
		</Suspense>
	);
}
export const metadata: Metadata = {
	title: 'Framer’s Calculator',
	description: 'Does some of the calculations for using a matteboard cutter.',
};
