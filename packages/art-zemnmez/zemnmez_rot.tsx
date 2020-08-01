import { Scale } from 'linear/component/art/scale';

export interface Config {
    smallSquare: number
    bigSquare: number
    gap: number
}

export const size:
    (c: Config) => [number, number]
=
    ({smallSquare: s, bigSquare: b, gap: g}) =>
        [
            s + g + b + g + s,
            s + g + b + g + s
        ];
;

const rect:
    (w: number, h: number) => string
=
    (w, h) => `l${[w,0]},${[0,h]},${[-w, 0]}z`
;


const sq:
    (w: number) => string
=
    w => rect(w,w)
;

export const Path:
    (f: Config) => string
=
    ({ smallSquare: smsq, bigSquare: bgsq, gap }) => {
        // top left small sq
        return `${sq(smsq)}` +

        // top long rect
        `m${smsq + gap},0` +
        `${rect(bgsq, smsq)}` +

        // middle sq
        `m0,${gap + smsq}` +
        `${sq(bgsq)}` +

        // left long rect
        `m${-gap - smsq},0` +
        `${rect(smsq, bgsq)}` +

        // bottom long rect
        `m${smsq+gap},${bgsq+gap}` +
        `${rect(bgsq, smsq)}` +

        // bottom right small sq
        `m${bgsq+gap},0` +
        `${sq(smsq)}` +

        // right long rect
        `m0,${-gap - bgsq}` +
        `${rect(smsq,bgsq)}`
    }
;


export const props:
    (p:  Config) => React.SVGAttributes<SVGPathElement>
=
    p => {
        const [ width, height ] = size(p);

        /**
         * the rotation itself is pretty simple,
         * but it is going to cause the rendered
         * of the shape to change. to fix this,
         * we need to scale it down a bit to keep it in the bounding box.
         *
         * In this case, the new width and height of our shape
         * is what was the diameter of the rectangle before.
         *
         * this is a right triangle sort of thing...
         * a^2/|b^2
         *  -c^2
         * d^2 = w^2 + h^2
         */
        const d = Math.sqrt(width ** 2 + height ** 2);
        const scale = width / d;
        const diff = (width -(scale * width)) /2;
        return {
            transform:
                `translate(${diff} ${diff}) scale(${scale}) ` +
                `rotate(-45, ${width/2}, ${height/2})`
        }
    }
;

const self = {
    path: Path,
    size: size,
    props
}

export const scaled = Scale(self, 'bigSquare', 'gap', 'smallSquare');

export default self;