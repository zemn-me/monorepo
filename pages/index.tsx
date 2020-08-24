import { Timeline, makeYears } from '@zemn.me/timeline/components';
import Eye from '@zemn.me/art/time';
import { Text } from '@zemn.me/lang/component';
import { Bio, Event } from '@zemn.me/bio';
import { Main, Div, A } from '@zemn.me/linear';
import Video from '@zemn.me/video';
import React from 'react';
import style from './home.module.css';
import * as i8n from '@zemn.me/linear/i8n';
import { TaggedTextContext } from '@zemn.me/lang/component';
import * as articles from '@zemn.me/article';

// file://1

let articleEvents = [];

for (const [year, ars] of Object.entries(articles.years)) {
    for (const [ident, article] of Object.entries(ars)) {
        if (article.hidden) continue;
        articleEvents.push({
            title: ["en-GB", article.title!],
            description: ["en-GB", article.inShort!],
            date: article.date!,
            url: new URL(`https://zemn.me/${year}/${ident}`)

        })
    }
}

console.log(articleEvents);

const timeline = [
    ...Bio.timeline,
    ...articleEvents
];

const Home = () => {
    const [langs, setLang] = React.useState<readonly string[]>(["en-gb"]);
    React.useEffect(() => {
        const onLangChange = () => setLang(navigator.languages);
        window.addEventListener('languagechange', onLangChange);
        const curLang = window?.navigator?.languages;
        if(curLang) setLang(curLang);
        return () => window.removeEventListener('languagechange', onLangChange);
    }, [ setLang ]);

    const [l] = langs;
    console.log(langs);

    const content = <>
        <Div className={style.header}>
            <Text into={<Div className={style.title}/>}>{Bio.who.handle}</Text>
            <Video/>
        </Div>

        <Div className={style.links}>
            {Bio.links.map(([label, link], i) => <Text key={i} {...{
                into: <A href={link}/>
            }}>{label}</Text>)}
        </Div>

        <Div className={style.navBar}>
            <Div className={style.eyeContainer}>
                <Eye className={style.eye}/>
            </Div>
        </Div>

        <Text into={<Div className={style.name}/>}>{Bio.who.name}</Text>

        <Timeline {...{
            years: makeYears(timeline),
            lang: 'en-GB',
            className: style.timeline
        }} />
    </>
return <Main lang={l} className={style.home}>
    <i8n.locale.Provider value={langs}>
        <TaggedTextContext.Provider value={{ lang: l }}>
            {content}
        </TaggedTextContext.Provider>
    </i8n.locale.Provider>
</Main>
}

export default Home;