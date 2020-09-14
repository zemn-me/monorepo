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


        return <div style={{
        }}>
            {ast.map(({ text, caption: cap }, i) => <React.Fragment key={i.toString()}>
                <div style={{
                    margin: "auto",
                    padding: ".2rem"
                }}></div>
                <code style={{
                    width: "100%",
                    overflow: "hidden",
                }}><pre>{text}</pre></code>
                {cap?<div style={{
                    color: "var(--mgc)"
                }}>{cap.split(/\n\s*\n/g).map((t, i) => <p key={i}>{t}</p>)}</div>:null}
            </React.Fragment>)}
        </div>
    }
;


export default CodeHelper;