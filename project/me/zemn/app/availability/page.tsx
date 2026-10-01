import { AvailabilityClient } from '#root/project/me/zemn/app/availability/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

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

export const handle = { metadata };
