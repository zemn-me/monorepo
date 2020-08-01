import { scaled as RotPath, Config } from './zemnmez_rot';
import log from '@zemnmez/macros/log.macro';
import React from 'react';
import { SizedPathSVG } from '../svg';

export interface LoadProps {
    className?: string,
    switchTime?: number
}

const frames: Config[] = [
    { smallSquare: 0.001, bigSquare: 0.001, gap: 1},
    { smallSquare: 1, bigSquare: 1, gap: 1},
    { smallSquare: 1, bigSquare: 5, gap: 1 },
];

export const Load:
    React.FC<LoadProps>
=
    ({ className, switchTime = 2000 }) => {
        const [frame, setFrame] = React.useState(0);

        React.useEffect(() => {
            const interval = setInterval(() => {
                setFrame(((frame+1)%(frames.length)))
            }, switchTime);

            return () =>
                clearInterval(interval);

        }, [ frame, setFrame, switchTime ]);

        log("playing frame", frame)

        return <SizedPathSVG {...{
            className,
            generator: RotPath,
            transition: `all ${switchTime/4}ms ease-in-out`,
            ...frames[frame]
        }}/>
    }
;
