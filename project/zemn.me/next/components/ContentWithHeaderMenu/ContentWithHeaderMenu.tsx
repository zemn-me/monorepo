import { ScrollUpMenu } from 'project/zemn.me/next/components/ScrollUpMenu';
import { TopLevelNavigationBar } from 'project/zemn.me/next/layouts/root/TopLevelNavigationBar/TopLevelNavigationBar';

export interface Props {
	readonly menuId: string;
	readonly children: [menu: React.ReactNode, main: React.ReactNode];
}

/**
 * Provided menu contents and page content,
 * creates a hamburger style navigation accordion above the content
 * and sets up the hamburger to scroll to the natigation accordion.
 *
 * The passed menuId will become the id of a menu element so that
 * clicking the hamburger scrolls to it.
 */
export function ContentWithHeaderMenu({
	menuId,
	children: [menu, main],
}: Props) {
	return (
		<ScrollUpMenu>
			<div id={menuId}>{menu}</div>
			<>
				<TopLevelNavigationBar />
				{main}
			</>
		</ScrollUpMenu>
	);
}
