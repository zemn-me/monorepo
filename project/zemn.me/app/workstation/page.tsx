import { Metadata } from 'next/types';

import { Redirect } from '#root/project/zemn.me/components/Redirect/Redirect.js';

export default function Page() {
	return <Redirect to={"https://api.zemn.me/workstation"} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my twitter',
};

