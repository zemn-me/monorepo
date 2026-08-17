import { MetadataRoute } from 'next/types';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			disallow: '/availability',
		},
	};
}
