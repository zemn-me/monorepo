import { Prose } from 'project/zemn.me/next/components/Prose/prose';
import { Title } from 'project/zemn.me/next/components/Title/Title';
import { ExperimentsLayout } from 'project/zemn.me/next/layouts/root/experiments/experiments';
import { NextPageWithLayout } from 'project/zemn.me/next/pages/_app';
import { ReactElement } from 'react';

const Page: NextPageWithLayout = function Experiments() {
	return (
		<>
			<Title>Experiments.</Title>
			<Prose>
				<p>
					Above are a few experiments I threw together. Hope they're
					fun.
				</p>
			</Prose>
		</>
	);
};

Page.getLayout = function getLayout(element: ReactElement) {
	return <ExperimentsLayout>{element}</ExperimentsLayout>;
};

export default Page;
