import { Bio } from '@zemn.me/bio';
import * as scale from 'd3-scale';
import * as axis from 'd3-axis';
import * as d3 from 'd3-selection';
import React from 'react';
import * as i8n from '@zemn.me/linear/i8n';
import style from './graph.module.sass';
import { T } from 'ts-toolbelt';
import rotProps from '@zemn.me/art-zemnmez/props.default';
const timeline = Bio.timeline;

enum Orientation {
    HORIZONTAL, VERTICAL
}

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

const regularAxisLabels = [ "x", "y", "x1", "y1", "x2", "y2" ] as const;
const inverseAxisLabels = ["y", "x", "y1", "x1", "y2", "x2" ] as const;
type AxisLabels = typeof regularAxisLabels | typeof inverseAxisLabels;

enum ScaleKind {
    CONTINUOUS,
    BAND,
    TIME
}

interface ScalePipProps {
    pipLength?: number
    label?: i8n.Text
    className?: string
    orientation: Orientation
    t: number
}


const ScalePip:
    (props: ScalePipProps) => React.ReactElement
=
    ({ pipLength = 5, label, className, orientation, t }) => <>
        <i8n.Text {...{
            into: <text {...{
                ...orientation == Orientation.HORIZONTAL?
                { x: `${t + pipLength}%`, y: `0` }:
                { y: `${t + pipLength}%`, x: `0` }
            }}/>,
            children: label
        }}/>

        <line {...{

        }}/>
    </>
;




interface ScaleContinuousProps extends PropsOf<'svg'> {
    readonly d3Scale: scale.ScaleContinuousNumeric<readonly [0, 100], number>
    readonly labels: Iterable<readonly[{ valueOf(): number },  i8n.Text]>
    readonly orientation: Orientation

    /** length of a pip. must be < 100 */
    readonly pipLength?: number
    readonly scaleKind: ScaleKind.CONTINUOUS
}

interface ScaleBandProps<T extends { toString(): string }> extends PropsOf<'svg'> {
    readonly d3Scale: scale.ScaleBand<T>
    readonly labels: Iterable<readonly[T,  i8n.Text]>
    readonly orientation: Orientation

    /** length of a pip. must be < 100 */
    readonly pipLength?: number
    readonly scaleKind: ScaleKind.BAND
}

interface ScaleTimeProps extends PropsOf<'svg'> {
    readonly d3Scale: scale.ScaleTime<readonly [0, 100], number>
    readonly orientation: Orientation
    readonly pipLength?: number
    readonly scaleKind: ScaleKind.TIME
    readonly labels?: undefined
}

type ScaleProps<T extends { toString(): string }> = ScaleContinuousProps |
    ScaleBandProps<T> | ScaleTimeProps


const Scale:
    <T extends { toString(): string }>(props: ScaleProps<T>) =>
        React.ReactElement<PropsOf<'svg'>>
=
    p =>{
        const { d3Scale: scale, labels, orientation,
                pipLength, scaleKind, ...svgProps } = p;

        // this lets us write once for horiz / vert by swapping orientations
        const axisLabels = p.orientation == Orientation.VERTICAL?
            regularAxisLabels:
            inverseAxisLabels;
        
        const [ , , x1, y1, x2, y2 ] =  axisLabels;
        
        
        return <svg {...svgProps}>
            {/* main axis line*/}
            <line {...{
                // the vertical line starts at the top right
                // corner and goes down
                [x1]: "100%",
                [y1]: "0%",
                [x2]: "100%",
                [y2]: "100%",
            }}/>

            {/* each of the pips on the axis */}
            {
                [...labels].map(label => <ScalePip {...{
                    axisLabels,
                    label,
                    pipLength,
                    d3Scale: scale,
                    scaleKind: p.scaleKind
                } as any}/>)
            }
        </svg>;
    }
;


interface ScaleYProps extends PropsOf<'svg'> {
    d3Scale: scale.ScaleBand<string>
}

const Graph:
    () => React.ReactElement
=
    () => {

        const dates = timeline.map(({ date }) => +date);

        const scaleTime = scale.scaleTime()
            .domain([new Date(Math.min(...dates)), new Date(Math.max(...dates))])
            .range([0, 100]); // %

        const tags = new Set<i8n.TextProps["children"]>();
        for (const event of timeline) {
            for (const tag of event.tags??[]) {
                tags.add(tag);
            }
        }

        type PackedText = i8n.Text & { toString(): string }

        const allTags = [...tags].map(t => Object.assign(t, {
                toString() {
                    return JSON.stringify(t)
                }
            }))

        const scaleTag = scale.scaleBand<{ toString(): string }>()
            .domain(allTags)
            .range([0, 100]); // %


        return <svg className={style.graph}>
            <svg>
                <Scale d3Scale={scaleTag} orientation={Orientation.VERTICAL}
                    width="15%" height="80%" scaleKind={ScaleKind.BAND}
                    labels={allTags.map(tag => [tag, tag])} />
                <svg width="80%" height="80%" x="20%" y="0%">
                    {timeline.map((e, i1) => e.tags?.map((tag, i2) => <rect {...{
                        key: i1 * i2,
                        x: `${scaleTime(e.date)}%`,
                        y: `${scaleTag(JSON.stringify(tag))}%`,
                        height: `${scaleTag.bandwidth()}%`,
                        width: "1"
                    }}/>))}
                </svg>
            </svg>
        </svg>
    }
;

export default Graph;