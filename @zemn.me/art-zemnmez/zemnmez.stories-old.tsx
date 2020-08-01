import rot, { scaled as rotPath } from './zemnmez_rot';
import { SizedPathSVG } from '../svg';
import React from 'react';
import { withKnobs, number, date, text } from "@storybook/addon-knobs";

export default { title: 'art/zemnmez', decorators: [withKnobs] }

export { Load } from './load';

const rotProps = {
    smallSquare: 1,
    bigSquare: 5,
    gap: 1
}

export const Rot_Unscaled = () => <svg viewBox={`0 0 ${rot.size(rotProps)}`}>
    <path d={'m0,0'+rot.path(rotProps)}/>
</svg>

export const Rot_Raw = () => <svg width={100} height={100}>
    <path d={'m0,0'+rotPath.path({
        width: 100,
        height: 100,
        ...rotProps
    })}/>
</svg>

export const Zemn_Rot = () =>
        <SizedPathSVG
            generator={rotPath}
            smallSquare={number("smallSquare", 1, {
                range: true,
                min: 0,
                max: 10,
                step: 1
            })}

            bigSquare={number("bigSquare", 5, {
                range: true,
                min: 0,
                max: 10,
                step: 1
            })}

            gap={number("gap", 1, {
                range: true,
                min: 0,
                max: 10,
                step: 1
            })}

        />