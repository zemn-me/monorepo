import React from 'react';

interface CodeHelperProps {
    prefix: string,
    children: string
}

const CodeHelper:
    (props: CodeHelperProps) => React.ReactElement
=
    ({ prefix, children }) => {
        const ast: { text: string, caption?: string }[] = [];
        let codelines: string[] = [];
        let annotationlines: string[] = [];

        const commit = () => {
            ast.push({
                text: codelines.join("\n") + "\n",
                caption: annotationlines.length? annotationlines.join(" \n "): undefined
            });

            [ codelines, annotationlines] = [ [], [] ]
        };

        for (const line of children.split("\n")) {
            if (line.trimLeft().startsWith(prefix)) {
                annotationlines.push(line.trimLeft().slice(prefix.length));
                continue;
            }

            codelines.push(line);

            if (line.trim() == "") commit();

        }


        return <ScrollAnnotator pairs={ast.map(({ text, caption }) => [
            caption?<>{caption.split(/\n\s*\n/g).map((t, i) => <p key={i.toString()}>{t}</p>)}</>:undefined,
            <>{text}</>
        ])}/>
    }
;

interface ScrollAnnotatorProps {
    pairs: readonly [React.ReactElement | undefined, React.ReactElement][]
}


// todo: make another element with commentary, that scrolls in tandem
const ScrollAnnotator:
    (props: ScrollAnnotatorProps) => React.ReactElement
=
    ({ pairs }) => {
        const [ visible, setVisible ] = React.useState<boolean>(false);
        const onVisibilityChanged = React.useCallback(([{ isIntersecting: v }]: {isIntersecting:boolean}[]) => {
            if (v != visible) setVisible(() => v);
        }, [setVisible])


        const [ observer, setObserver ] = React.useState<IntersectionObserver>();
        
        React.useEffect(() => {
            setObserver(new IntersectionObserver(onVisibilityChanged, {
                // until we're at least 50% intersecting, nothing can be centered
                threshold: [0, 0.5]   
            }));
            return () => observer?.disconnect();
        }, [ setObserver ]);

        const onRootMount = React.useCallback((el: Element | null) =>
            {if(el) observer?.observe(el)}, [observer]);

        const [ children, setChildren ] = React.useState<{
            readonly fromEl: Map<Element, number>,
            readonly toEl: Map<number, Element>
        }>({ fromEl: new Map(), toEl: new Map() });
        const onChildMount = React.useCallback((idx: number) => (el: Element | null) => {
            if (!(el && !children.fromEl.has(el))) return;

            children.fromEl.set(el, idx);
            children.toEl.set(idx, el);
        }, [setChildren]);


        const [ highlightedChild, setHighlightedChild ] = React.useState<number | undefined>();
        const onScroll = React.useCallback(() => {
            const center = window.innerHeight / 2;
            for (const [child, idx] of children.fromEl) {
                const { top, bottom } = child.getBoundingClientRect();
                const intersects = center > top && center < bottom;
                if (intersects) return setHighlightedChild(idx);
            }
        }, [ children ]);

        const highlightedChildHasCaption = highlightedChild && pairs[highlightedChild][0] !== undefined

        React.useEffect(() => console.log("visibility changed to", visible), [visible]);

        React.useEffect(() => {
            if (visible) window.addEventListener('scroll', onScroll);
            return () => {
                window.removeEventListener('scroll', onScroll);
            }
        }, [ visible, onScroll ]);


        return <div {...{
        style: {
            position: "relative",
            display: "block"
        }
        }}>
            {<div {...{
                style: {
                    position: "absolute",
                    background: "var(--bgc)",
                    borderBottom: "1px solid var(--fgc)",
                    ...highlightedChild !== undefined?
                        {
                            top: `${children.toEl.get(highlightedChild)!.offsetTop}px`
                        }
                        :{}
                }
            }}>{highlightedChild!==undefined?pairs[highlightedChild][0]:null}</div>}
            
            <code ref={onRootMount}>
                {pairs.map(([cap, code], idx) => 
                    <div ref={onChildMount(idx)} {...{
                        style: {
                            ...highlightedChildHasCaption !== undefined && highlightedChild == idx
                                ? { background: "var(--mgc)" }
                                : {}
                        }
                    }}>{code}</div>
                )}
            </code>
        </div>
       
        

    }
;


export default CodeHelper;