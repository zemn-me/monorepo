import TimeEye from '@zemn.me/art/time';
import Link from 'next/link';
import style from './sink.module.sass';
import * as element from 'linear2/features/elements';


export const Sink: React.FC = function Sink({ children }) {
    return <element.main className={style.Sink}>
        <header className={style.header}>
            <Link href="/"><element.a className={style.logo}><TimeEye/></element.a></Link>
            <Link href="/cv"><element.a>cv</element.a></Link>
            <Link href="/article"><element.a>article</element.a></Link>
            <Link href="mailto:zemnmez+business@gmail.com"><element.a>business</element.a></Link>
        </header>
        <div className={style.Content}>
        {children}
        </div>
    </element.main>
}

export default function SinkTest() {
    return <Sink>Content!</Sink>   
};