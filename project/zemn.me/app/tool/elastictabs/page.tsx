import { Metadata } from "next/types";
import { Suspense } from "react";

import ElasticTabStopsClient from "#root/project/zemn.me/app/tool/elastictabs/client.js";

export default function Page() {
	return (
		<Suspense fallback={null}>
			<ElasticTabStopsClient/>
		</Suspense>
	);
}

export const metadata: Metadata = {
	title: 'Elastic Tabstops Online',
	description: 'align tabbed columns automatically online!'
}
