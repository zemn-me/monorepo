import { Archive } from './archive.js';
export default function Manage() {
	return <Archive managing />;
}
export const handle = {
	metadata: { title: 'Manage issues', robots: { index: false } },
};
