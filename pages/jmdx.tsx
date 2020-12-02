import parse from 'linear2/features/jmdx/parse'
import vfile from 'to-vfile';
import path from 'path';
import inspect from 'unist-util-inspect';
import * as jmdx from 'linear2/features/jmdx';
import * as elements from 'linear2/features/elements';


export async function getStaticProps() {
    const content = 
            await vfile.read(path.join(process.cwd(), "pages", "article", "2020", "icloud", "index.mdx"))

    return { props: { content: JSON.parse(JSON.stringify(await parse(content)))} }
}

const Renderer:
    (props: jmdx.Node) => React.ReactElement
=
    ({ type, ...props }) => {
        const { children } = props;
        switch (type) {
        case 'root': return children;
        case 'thematicBreak': return <jmdx.mdast.ThematicBreak {...props}/>
        case 'paragraph': return <jmdx.mdast.Paragraph {...props}/>
        case 'meta': return <meta {...props}/>
        case 'text': return <jmdx.mdast.Text {...props}/>
        case 'list': return <jmdx.mdast.List {...props}/>
        case 'listItem': return <jmdx.mdast.ListItem {...props}/>
        case 'linkReference': return null;
        case 'section': return <section {...props}/>
        case 'heading': return <elements.Heading {...props}/>
        case 'date': return "<Date/>";
        default:
            return <p>Unknown {type}</p>
        }
    }
;

export default function Jmdx(props) {
    return <jmdx.Render node={props.content} render={<Renderer/>}/>
    //return <>{inspect(props)}</>
    /*return <RenderDebug fragment={props.content}
        elements={{
            elements: elements,
            //unknown: () => "unknown"
        }}/>*/
}