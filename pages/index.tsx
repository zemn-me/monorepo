import { Timeline, makeYears } from '@zemn.me/timeline/components';
import Eye from '@zemn.me/art/time';
import { Bio } from '@zemn.me/bio';
import * as e from 'linear2/features/elements';
import Video from '@zemn.me/video';
import React from 'react';
import style from './home.module.css';
import * as bio from 'lib/bio';
import * as elements from 'linear2/features/elements';
import * as lang from 'linear2/model/lang';

interface HomeProps {
    filter?: (event: bio.Event) => boolean
}

const Home:
    (props: HomeProps) => React.ReactElement
= ({ filter }) => {


    const years = makeYears(bio.timeline);

    const content = <>
        <e.WithLang lang={lang.get(Bio.who.handle)}>
            <e.div className={style.header}>
                {Bio.who.handle}
                <Video/>
            </e.div>
        </e.WithLang>

        <e.div className={style.links}>
            {Bio.links.map(([label, link], i) => 
                <e.WithLang lang={lang.get(label)}>
                    <e.a href={link}>{label}</e.a>
                </e.WithLang>
            )}
        </e.div>

        <e.div className={style.navBar}>
            <e.div className={style.eyeContainer}>
                <Eye className={style.eye}/>
            </e.div>
        </e.div>

        <e.WithLang lang={lang.get(Bio.who.name)}>
            <e.div className={style.name}>{Bio.who.name}</e.div>
        </e.WithLang>

        <Timeline {...{
            years,
            lang: 'en-GB',
            className: style.timeline
        }} />
    </>
    return content;
}

export default Home;
