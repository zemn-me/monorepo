import { DefaultLayout } from 'project/zemn.me/next/components/NavBar/NavBar';
import style from 'project/zemn.me/next/pages/404.module.css';
import { ReactElement } from 'react';

export const Page = function NotFound() {
	return (
		<main className={style.NotFound}>
			<i lang="en-GB">The requested resource was not found.</i>
		</main>
	);
};

Page.getLayout = function (page: ReactElement) {
	return <DefaultLayout>{page}</DefaultLayout>;
};

export default Page;
