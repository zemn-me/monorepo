import { Metadata } from 'next/types';

import GrievancePortal from "#root/project/zemn.me/app/grievanceportal/client.js";

export default function Page() {
        return <GrievancePortal />;
}

export const metadata: Metadata = {
        title: 'Grievance Portal',
        description: 'Submit and track grievances.',
};
