import remarkValidateLinks from 'remark-validate-links';
import remarkSubSuper from 'remark-sub-super';
import remarkHeadingId from 'remark-heading-id';
import remarkFootnotes from 'remark-footnotes';
import remarkLintNoUndefinedReference from 'remark-lint-no-undefined-references';
import remarkLintNoHeadingLikeParagraph from 'remark-lint-no-heading-like-paragraph';
import remarkSmartypants from '@silvenon/remark-smartypants';
import sectionize from './sectionize';
import unistUtilVisitParents from 'unist-util-visit-parents';

const correctQuotedCodeQuote = () => tree => unistUtilVisitParents(
    tree, node => node.type == "text"
        && (node.value.endsWith("'") || node.value.endsWith('"')),

    (node, ancestors) => {
    const endsWith = node.value.slice(-1)[0];
    const parent = ancestors.slice(-1)[0];
    const i = parent.children.indexOf(node);
    if (i == -1) throw new Error("child not parented to parent");
    const [maybeCodeQuote, maybeText] = [
        parent.children[i + 1],
        parent.children[i + 2]
    ];

    if (!(maybeCodeQuote || maybeText)) return;
    if (maybeCodeQuote.type !== "inlineCode") return;
    if (maybeText.type !== "text") return;
    if (!(maybeText.value.startsWith(endsWith))) return;

    if (endsWith == "'") {
        node.value = node.value.slice(0, -1) + "‘";
        console.log(maybeText.value);
        maybeText.value = "’" + maybeText.value.slice(1)
    }
})

const remarkCaptions = [
    require('remark-captions'), {
        internal: {
            image: 'Figure:',
            blockquote: '-- '
        }
    }
];

export default [
    remarkValidateLinks,
    remarkSubSuper,
    remarkHeadingId,
    remarkFootnotes,
    remarkLintNoUndefinedReference,
    remarkLintNoHeadingLikeParagraph,
    correctQuotedCodeQuote,
    ...remarkCaptions,
    remarkSmartypants,
    sectionize
]