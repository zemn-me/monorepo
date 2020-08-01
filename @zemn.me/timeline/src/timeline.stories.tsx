import { Timeline, makeYears } from './components';
import { Bio } from '@zemn.me/bio';
import React from 'react';

export const _Timeline = () =>
    <Timeline {...{
        years: makeYears(Bio.timeline),
        lang: 'en-GB'
    }} />

export default {
    title: "linear/Timeline",
    component: Timeline
}