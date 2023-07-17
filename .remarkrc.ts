import remarkRetext from "remark-retext";
import { unified } from "unified";
import retextEnglish from "retext-english";
import retextSyntaxMentions from "retext-syntax-mentions";
import retextSyntaxUrls from "retext-syntax-urls";
import retextSpell from "retext-spell";
import dictionary from "dictionary-en";
import retextContractions from "retext-contractions";
import retextDiacritics from "retext-diacritics";
import retextEquality from "retext-equality";
import retextIndefiniteArticle from "retext-indefinite-article";
import retextIntensify from "retext-intensify";
import retextPassive from "retext-passive";
import retextProfanities from "retext-profanities";
import retextReadability from "retext-readability";
import retextRedundantAcronyms from "retext-redundant-acronyms";
import retextRepeatedWords from "retext-repeated-words";
import retextSentenceSpacing from "retext-sentence-spacing";
import retextSimplify from "retext-simplify";

export default {
  plugins: [
    [
      remarkRetext,
      unified().use([
        retextEnglish,
        retextSyntaxMentions,
        retextSyntaxUrls,
        [retextSpell, dictionary],
        retextContractions,
        retextDiacritics,
        retextEquality,
        retextIndefiniteArticle,
        retextIntensify,
        retextPassive,
        retextProfanities,
        retextReadability,
        retextRedundantAcronyms,
        retextRepeatedWords,
        retextSentenceSpacing,
        retextSimplify,
      ]),
    ],
  ],
};