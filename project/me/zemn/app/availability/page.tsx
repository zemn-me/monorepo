import { Metadata } from 'next/types';

import { AvailabilityClient } from '#root/project/me/zemn/app/availability/client.js';

export default function AvailabilityPage() {
	return <AvailabilityClient />;
}

export const metadata: Metadata = {
	title: "Thomas' Availability",
	robots: {
		follow: false,
		index: false,
	},
};
