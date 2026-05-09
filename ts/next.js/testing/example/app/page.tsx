/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
import * as vec from '#root/ts/math/vec.js';

export default function Home() {
	console.log(vec.add([1], [1]));
	return <>Hello, world!</>;
}
