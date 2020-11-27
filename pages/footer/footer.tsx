import Link from 'next/link';


export default function Footer() {
    return <footer>
        <Link href="/">
            <a>home</a>
        </Link>

        <Link href="/article">
            <a>articles</a>
        </Link>
    </footer>
}