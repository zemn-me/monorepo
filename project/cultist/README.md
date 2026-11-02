Project Cultist
---------------

I'm a huge fan of the game [Cultist Simulator]. Over the pandemic, I wanted to create a multiplayer version
and an optimized speedrun of the game. Since the game logic is implemented fairly simply, it's not super hard
to do [A*] to try to find the shortest route from start to end.

[Cultist Simulator]: https://store.steampowered.com/app/718670/Cultist_Simulator/
[A*]: https://en.wikipedia.org/wiki/A*_search_algorithm

This project was my first to use Bazel and eventually grew into this monorepo.

If I were to come back to this project, I'd probably replace the serde & protobufs type code with Zod.
