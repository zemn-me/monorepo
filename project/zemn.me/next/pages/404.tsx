import { RootLayout } from 'project/zemn.me/next/layouts/root/root';
import { NextPageWithLayout } from 'project/zemn.me/next/pages/_app';
import style from 'project/zemn.me/next/pages/404.module.css';
import { ReactElement } from 'react';

const Page: NextPageWithLayout = function NotFound() {
	return (
		<main className={style.NotFound}>
			<i lang="en-GB">The requested resource was not found.</i>
		</main>
	);
};

Page.getLayout = function getLayout(page: ReactElement) {
	return <RootLayout>{page}</RootLayout>;
};

export default Page;
