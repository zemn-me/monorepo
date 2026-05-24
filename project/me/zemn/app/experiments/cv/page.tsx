import { permanentRedirect } from 'next/navigation';
import { Metadata } from 'next/types';

export default function Page() {
	permanentRedirect('/cv');
}

export const metadata: Metadata = {
	description: 'Redirect to my CV.',
};
