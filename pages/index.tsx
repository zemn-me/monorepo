import { Timeline, makeYears } from '@zemn.me/timeline/components';
import { Bio } from '@zemn.me/bio';
import { Main } from '@zemn.me/linear';
import Video from '@zemn.me/video';
import React from 'react';

export const Home = () => <Main>
    <Video/>
    <Timeline {...{
        years: makeYears(Bio.timeline),
        lang: 'en-GB'
    }} />
</Main>

export default Home;