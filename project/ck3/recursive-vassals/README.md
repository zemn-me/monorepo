# project/ck3/recursive-vassals

[Steam Workshop Page]

This is a small mod inspired by the YouTube series [Do it For Bruce!], which showcases various AI timelapses in CK3. In one timelapse, the world is ruled by [Theocratic empires][Theocratic Government] but they shatter almost immediately due to the fact that Theocratic rulers do not create theocratic realms / vassals underneath them. This causes them to create lots of feudal vassals who immediately overthrow them.

This mod overrides `common/on_action/title_on_actions.txt` so that when a title is issued to a vassal with a Theocratic or Republican liege, the ruler is made respectfully Theocratic or Republican.

This creates some interesting gameplay as Theocratic vassals provide really great tax (up to nearly 50%!!) to pious rulers and do not rebel -- but themselves do not get great tax from their vassals. In short, granting lots of land to say, your head of faith will make lots of converted realms of your religion that will be incredible in a crusade, but probably won't line your own coffers very much.

Republican vassals are mostly a PITA. They, like Theocratic vassals, have no partition, meaning their power will nearly always grow over time, they get 100% of income from cities, and upon death they get replaced by a new ruler with the culture and religion of their home county -- and they DO know how to rebel. Still, establishing a big republican realm and granting it independence is a great way to create a strong buffer state.

[Steam Workshop Page]: https://steamcommunity.com/sharedfiles/filedetails/?id=2775158644
[Do it For Bruce!]: https://www.youtube.com/watch?v=5qo4cqtyjuE
[Theocratic Government]: https://ck3.paradoxwikis.com/Government#Theocracy

## Known issues

 - A feudal, clan or tribal vassal that gains a title will always take the government of their liege. It would be nice to do this only for newly created vassals, but I am unsure how.

 ## Building

 The target `:mod_zip` builds a zip file, i.e. run `yarn bazel build //project/ck3/recursive-vassals:mod_zip`. It is output as a build artifact in each release.
