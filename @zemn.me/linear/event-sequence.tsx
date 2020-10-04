import React from 'react';
import * as svg from '@zemn.me/svg';
import { Ticks, labels, DIRECTION } from '@zemn.me/svg/scale';
import { Dated } from '@zemn.me/interface';
import * as d3Scale from 'd3-scale';

const d3 = {
    ...d3Scale
};

export interface Event extends Dated {
    date: Date
    event: string
}

export interface EventProps {
    children: Event[]
}

export const EventSequence:
    (props: EventProps) => React.ReactElement
=
    ({ children }) => {
        const scale =  d3.scaleTime()
                .domain(children.map(({ date }) => date))
                .range([ 0, 100 ]);
    
    return <svg>

        <svg y="50%">
            <Ticks {...{
                scale: labels(scale, ...children.map(({ date, event }) => [date, event] as const)),
                direction: DIRECTION.Up
            }}/>
        </svg>
 
        <svg y="50%">
            <Ticks {...{
                scale:scale,
                ticks: 4,
                direction: DIRECTION.Up
            }}/>
        </svg>
    </svg>
    }
;