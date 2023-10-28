import * as vec from 'ts/math/vec';
import style from 'ts/next.js/testing/example/pages/index.module.css';

export default function Home() {
	console.log(vec.add([1], [1]));
	return <div className={style.testElement}>Hello, world!</div>;
}
