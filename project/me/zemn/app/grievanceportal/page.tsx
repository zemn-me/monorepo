import GrievancePortal from '#root/project/me/zemn/app/grievanceportal/client.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return <GrievancePortal />;
}

export const metadata: Metadata = {
	title: 'Grievance Portal',
	description: 'Submit and track grievances.',
};
