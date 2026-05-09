import { useParams } from 'react-router';

import Page, {
	metadata,
} from '#root/project/me/zemn/app/src/[[...slug]]/page.js';
import { pageMeta } from './meta.js';

export default function SourceRedirectRoute() {
	const splat = useParams()['*'];
	const slug = splat ? splat.split('/').filter(Boolean) : undefined;
	return <Page params={{ slug }} />;
}

export const meta = pageMeta(metadata);
