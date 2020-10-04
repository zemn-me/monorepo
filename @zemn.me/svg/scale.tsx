import * as matrix from '@zemn.me/math/matrix';
import React from 'react';
import * as d3Scale from 'd3-scale';
import * as axis from 'd3-axis';
import * as svg from './index';
import * as vec from '@zemn.me/math/vec';



type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

const mirror = matrix.as<2,2>([ [1, 0], [0, 1] ] as const);

export type Num = number | { valueOf(): number };

export const labels:
    <N extends Num>(s: AxisScale<N>, ...labels: ReadonlyArray<readonly [N, string]>) => AxisScale<N>
=
    <N extends Num>(s: AxisScale<N>, ...labels: ReadonlyArray<readonly [N, string]>) => {
        const ret = {
            mappings: new Map(labels),
            domain() { return s.domain() },
            ticks() { return labels.map(([N]) => N) },
            tickFormat(){ return (N: N) => this.mappings.get(N)! }
        } as const;
        return ret;
    }
;

export interface AxisScale<N extends Num> {
    ticks(count?: number): N[];
    domain(): N[]
    tickFormat(count?: number, specifier?: string): (d: N) => string;
}

export enum DIRECTION {
    /** ticks ascend from the baseline */
    Up,
    
    /** ticks descend from the baseline */
    Down
}

export interface TicksProps<N extends Num> {
    scale: AxisScale<N>
    ticks?: number
    tickFormat?: string
    stroke?: string,
    direction?: DIRECTION
}

export const Ticks:
    <N extends Num>(props: TicksProps<N>) => React.ReactElement
=
    ({ scale, ticks: nTicks, tickFormat, stroke = "black", direction = DIRECTION.Down }) => {
        const formatter = scale.tickFormat(nTicks, tickFormat);
        const ticks = scale.ticks(nTicks).sort();
        const percScale = d3Scale.scaleLinear()
            .domain(scale.domain())
            .range([ 0 , 100 ]);
        
        const axisScale: (n: number) => svg.Percent =
            n => svg.Perc(percScale(n));
        

        return <>
            <svg.Line {...{
                path: matrix.map([ [ 0, 0 ], [ 0, 100 ] ] as const, svg.Perc),
                stroke
            }}/>

            {
                ticks.map( tick => {
                    const text = formatter(tick);
                    const pos = axisScale(tick.valueOf());
                    const tickBottomPos = [ pos, svg.Perc(10) ] as const;
                    let tickPath: svg.Path =
                        [ [ pos, svg.Perc(0) ], tickBottomPos ] as const;

                    let textMiddlePos: svg.Point = [vec.map(
                        vec.add(vec.map(tickBottomPos, v => v.valueOf()), [ 0, 20 ] as const),
                        svg.Perc
                    )] as const;

                    // if the direction is upward, reverse everything about
                    // y = 0% by inverting signs and adding the minimum value
                    // on the y axis

                    if (direction = DIRECTION.Up) {
                        [ tickPath, textMiddlePos ] = [ tickPath, textMiddlePos]
                                .map(
                                    v => svg.Matrix2Perc(
                                        matrix.mul(svg.MatrixFromPerc(tickPath), [ [ 1, 0 ], [ 0, -1 ] ]));
                            
                        ];

                        const [ 
                    };




                    return <React.Fragment key={tick.toString()}>
                        <svg.Line {...{
                            path: tickPath,
                            stroke
                        }}/>

                        <svg.Text
                            textAnchor="middle"
                            pos={textMiddlePos}
                        >{text}</svg.Text>

                    </React.Fragment>
                })
            }
        </>
    }
;