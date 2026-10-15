import {
    engineData,
    engineJavaScript,
    engineWasm,
    gameData,
    gameLicense,
    launcher,
    license,
    thirdPartyNotices,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/assets.js';

export function loader() {
    return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tiberian Sun · zemn.me</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#101412;color:#e5eade;font:16px/1.5 system-ui}main{max-width:64rem;margin:auto;padding:1.5rem}a{color:#bee899}header{display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}h1{font-size:clamp(1.6rem,4vw,2.4rem);margin:1rem 0}.notice,footer{font-size:.85rem;color:#b6bfb2}label{display:block;margin:1rem 0}input,button{font:inherit;min-height:44px}input{max-width:100%}button{padding:.5rem 1rem;border:1px solid #63725c;border-radius:.4rem;background:#273d26;color:#efffe4;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #c0ed86;outline-offset:3px}#status{min-height:1.5em}canvas{display:block;width:800px;max-width:100%;height:auto;background:#000;outline:none;margin:1rem auto}canvas[hidden]{display:none}canvas:focus-visible{outline:2px solid #c0ed86}canvas:fullscreen{width:100%;height:100%;object-fit:contain}pre{white-space:pre-wrap;max-height:12rem;overflow:auto}footer{margin-top:2rem}details{margin-top:1rem}

#game-view{position:fixed;inset:0;background:#000;z-index:1}#game-view[hidden]{display:none}#game-view canvas{width:100%;height:100%;max-width:none;margin:0;object-fit:contain}body[data-state]{overflow:hidden}body[data-state="loading"] main{position:fixed;inset:0;max-width:none;box-sizing:border-box;display:grid;place-items:center;background:#000}body[data-state="loading"] main>:not(#feedback){display:none}body[data-state="running"] main{display:none}
</style></head><body data-state="loading"><main>
<header><a href="/experiments">← Experiments</a><span class="notice">EA has not endorsed and does not support this product.</span></header>
<h1>Tiberian Sun</h1>
<p>Use a keyboard and mouse. Exit the game to return to the previous page.</p>
<p class="notice">Experimental browser port. Campaigns, Firestorm gameplay, and multiplayer have not been verified.</p>
<p>Game files download when you start. Music and movies are not included. Saved games are kept in this browser.</p>
<div id="feedback"><p id="status" role="status" tabindex="-1">Loading Tiberian Sun…</p>
<progress id="progress" aria-label="Downloading game files" hidden></progress>
</div>
<footer>Engine: OpenTS, compiled from C++ to WebAssembly. <a href="${license}">License</a> · <a href="${thirdPartyNotices}">Third-party notices</a> · <a href="https://github.com/zemn-me/monorepo/tree/main/project/tiberian_sun">Source and build instructions</a> · <a href="https://archive.org/details/command-and-conquer-tiberian-sun">Freeware game data source</a> · <a href="${gameLicense}">Original game license</a></footer>
<script type="module" src="${launcher}" data-engine="${engineJavaScript}" data-wasm="${engineWasm}" data-data="${engineData}" data-game="${gameData}"></script>
</main><div id="game-view" hidden><canvas id="canvas" width="800" height="600" tabindex="0" aria-label="Tiberian Sun game"></canvas></div></body></html>`, {
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=0, s-maxage=300',
            'content-security-policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
        },
    });
}
