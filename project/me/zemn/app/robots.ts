import { MetadataRoute } from 'next/types';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			disallow: '/availability',
		},
	};
}
