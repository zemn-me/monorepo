import parse from 'linear2/features/jmdx/parse'
import vfile from 'to-vfile';
import path from 'path';
import inspect from 'unist-util-inspect';

const ThematicBreak = props => React.createElement('hr', props.properties);

export async function getStaticProps() {
    const content = 
            await vfile.read(path.join(process.cwd(), "pages", "article", "2020", "icloud", "index.mdx"))

    return { props: { content: JSON.parse(JSON.stringify(await parse(content)))} }
}

export default function Jmdx(props) {
    return <>{inspect(props)}</>
    /*return <RenderDebug fragment={props.content}
        elements={{
            elements: elements,
            //unknown: () => "unknown"
        }}/>*/
}