import * as vec from 'monorepo/ts/math/vec';

import 'monorepo/ts/next.js/testing/css_module_import/remote';

export default function Home() {
	console.log(vec.add([1], [1]));
	return <>Hello, world!</>;
}
