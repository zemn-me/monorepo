import { Metadata } from "next/types";

import ElasticTabStopsClient from "#root/project/zemn.me/app/tool/elastictabs/client.js";

export default function Page() {
	return <ElasticTabStopsClient/>
}

export const metadata: Metadata = {
	title: 'Elastic Tabstops Online',
	description: 'align tabbed columns automatically online!'
}
