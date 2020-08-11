import React from 'react';
import style from './pullDown.module.sass';
import { classes } from './classes';
import { Div } from './elements';

export interface PullDownProps {
    children: readonly [
        menu: React.ReactElement<{ className?: string }>,
        content: React.ReactElement<{
            className?: string,
            ref: React.Ref<Pick<Element, 'scrollIntoView'>>
        }>
    ]
}



export const PullDown:
    (props: PullDownProps) => React.ReactElement
=
    ({ children: [menu, content] }) => {
        const ref = React.useRef<Pick<Element, 'scrollIntoView'>>(null);
        const { current: el } = ref;

        // though typescript does not know it, this may not be
        // possible due to SSR
        React?.useLayoutEffect(() => {
            el?.scrollIntoView();
            console.log("scrolling", el, "into view");
        }, [ el ]);

        return <Div className={style.base}>
            {
                React.cloneElement(menu, {
                    ...menu.props,
                    ...classes(menu.props.className, style.pull)
                })
            }

            {
                React.cloneElement(content, {
                    ...content.props,
                    ...classes(style.content, content.props.className, style.content),
                    ref
                })
            }
        </Div>
    }

    
;

export default PullDown;