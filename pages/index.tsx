import { Timeline, makeYears } from '@zemn.me/timeline/components';
import Eye from '@zemn.me/art/time';
import { Text } from '@zemn.me/lang/component';
import { Bio } from '@zemn.me/bio';
import { Main, Div } from '@zemn.me/linear';
import Video from '@zemn.me/video';
import React from 'react';
import style from './home.module.css';

export const Home = () => <Main className={style.home}>
    <Div className={style.header}>
        <Text into={<Div className={style.title}/>}>{Bio.who.handle}</Text>
        <Video/>
    </Div>

    <Div className={style.navBar}>
        <Div className={style.eyeContainer}>
            <Eye className={style.eye}/>
        </Div>
    </Div>

    <Text into={<Div className={style.name}/>}>{Bio.who.name}</Text>

    <Timeline {...{
        years: makeYears(Bio.timeline),
        lang: 'en-GB',
        className: style.timeline
    }} />
</Main>

export default Home;