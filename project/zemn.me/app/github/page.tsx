'use client';
import { Metadata } from 'next/types';
import { links } from 'project/zemn.me/bio';
import Redirect from 'ts/next.js/component/Redirect/app';

export default function Page() {
	return <Redirect to={links.get('github')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my github',
};
