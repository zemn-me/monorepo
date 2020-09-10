import * as bio from '@zemn.me/bio'
import * as article from 'lib/article';
import * as i8n from '@zemn.me/linear/i8n';
export * from '@zemn.me/bio' ;

export const timeline = [
    ...bio.Bio.timeline,
    ...article.articles
    .map((meta) => ({
        date: meta.date,
        title: [meta.language as any, meta.title] as i8n.TaggedText,
        description: [meta.language as any, meta.subtitle] as i8n.TaggedText,
        tags: meta.tags?.map(t => [meta.language, t] as i8n.TaggedText),
        url: meta.__resourcePath.replace(/\/(?:index)\..*$/g,'')
    }))
];

