load("@npm//:@react-router/dev/package_json.bzl", react_router_bin = "bin")
load("@npm//:vite/package_json.bzl", vite_bin = "bin")
load("@rules_itest//private:itest.bzl", "itest_service")

def _remix_js_project(name):
    native.genrule(
        name = name,
        outs = ["jsconfig.json"],
        cmd_bash = """
            echo '{ "compilerOptions": { "baseUrl": \"""" + "/".join([".." for x in native.package_name().split("/")]) + """\" }}' > $@
        """,
    )

def _remix_entry_client(name):
    native.genrule(
        name = name,
        outs = ["router/entry.client.tsx"],
        cmd_bash = """
            cat > $@ <<'EOF'
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
\thydrateRoot(
\t\tdocument,
\t\t<StrictMode>
\t\t\t<HydratedRouter />
\t\t</StrictMode>,
\t);
});
EOF
        """,
    )

def _remix_entry_server(name):
    native.genrule(
        name = name,
        outs = ["router/entry.server.tsx"],
        cmd_bash = """
            cat > $@ <<'EOF'
import { PassThrough } from 'node:stream';

import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';

export const streamTimeout = 5_000;

export default function handleRequest(
\trequest,
\tresponseStatusCode,
\tresponseHeaders,
\trouterContext,
) {
\tif (request.method.toUpperCase() === 'HEAD') {
\t\treturn new Response(null, {
\t\t\theaders: responseHeaders,
\t\t\tstatus: responseStatusCode,
\t\t});
\t}

\treturn new Promise((resolve, reject) => {
\t\tlet shellRendered = false;
\t\tconst userAgent = request.headers.get('user-agent');
\t\tconst readyOption =
\t\t\t(userAgent && isbot(userAgent)) || routerContext.isSpaMode
\t\t\t\t? 'onAllReady'
\t\t\t\t: 'onShellReady';
\t\tlet abort;
\t\tlet timeoutId = setTimeout(() => abort?.(), streamTimeout + 1000);

\t\tconst { pipe, abort: abortStream } = renderToPipeableStream(
\t\t\tcreateElement(ServerRouter, {
\t\t\t\tcontext: routerContext,
\t\t\t\turl: request.url,
\t\t\t}),
\t\t\t{
\t\t\t\t[readyOption]() {
\t\t\t\t\tshellRendered = true;
\t\t\t\t\tconst body = new PassThrough({
\t\t\t\t\t\tfinal(callback) {
\t\t\t\t\t\t\tclearTimeout(timeoutId);
\t\t\t\t\t\t\ttimeoutId = undefined;
\t\t\t\t\t\t\tcallback();
\t\t\t\t\t\t},
\t\t\t\t\t});
\t\t\t\t\tconst stream = createReadableStreamFromReadable(body);

\t\t\t\t\tresponseHeaders.set('Content-Type', 'text/html; charset=utf-8');
\t\t\t\t\tpipe(body);
\t\t\t\t\tresolve(
\t\t\t\t\t\tnew Response(stream, {
\t\t\t\t\t\t\theaders: responseHeaders,
\t\t\t\t\t\t\tstatus: responseStatusCode,
\t\t\t\t\t\t}),
\t\t\t\t\t);
\t\t\t\t},
\t\t\t\tonError(error) {
\t\t\t\t\tresponseStatusCode = 500;
\t\t\t\t\tif (shellRendered) {
\t\t\t\t\t\tconsole.error(error);
\t\t\t\t\t}
\t\t\t\t},
\t\t\t\tonShellError(error) {
\t\t\t\t\treject(error);
\t\t\t\t},
\t\t\t},
\t\t);
\t\tabort = abortStream;
\t});
}
EOF
        """,
    )

def _remix_srcset(
        entry_client = None,
        entry_server = None,
        jsproject_json = None,
        srcs = []):
    return srcs + [
        jsproject_json,
        entry_client,
        entry_server,
        "react-router.config.ts",
        "vite.config.ts",
        "//:node_modules/@react-router/dev",
        "//:node_modules/@react-router/node",
        "//:node_modules/@types/node",
        "//:node_modules/@types/react",
        "//:node_modules/@types/react-dom",
        "//:node_modules/isbot",
        "//:node_modules/react",
        "//:node_modules/react-dom",
        "//:node_modules/react-router",
        "//:node_modules/typescript",
        "//:node_modules/vite",
        "//:package_json",
    ]

def remix_itest_service(
        name,
        exe = None,
        args = [],
        **kwargs):
    itest_service(
        name = name,
        args = args + [
            "--port",
            "$${PORT}",
        ],
        health_check_timeout = "120s",
        autoassign_port = True,
        exe = exe,
        **kwargs
    )

def remix_itest_service_dev(
        name,
        exe = None,
        args = [],
        **kwargs):
    itest_service(
        name = name,
        args = args + [
            "--port",
            "3000",
        ],
        health_check_timeout = "60s",
        exe = exe,
        **kwargs
    )

def remix_project(
        name,
        srcs,
        visibility = None,
        **kwargs):
    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs,
    )

    _remix_js_project(
        name + "_jsconfig",
    )

    _remix_entry_client(
        name + "_entry_client",
    )

    _remix_entry_server(
        name + "_entry_server",
    )

    srcs = _remix_srcset(
        entry_client = ":" + name + "_entry_client",
        entry_server = ":" + name + "_entry_server",
        jsproject_json = ":" + name + "_jsconfig",
        srcs = srcs,
    )

    react_router_bin.react_router(
        name = "build",
        srcs = srcs,
        args = ["build", "."],
        chdir = native.package_name(),
        out_dirs = ["build"],
        visibility = visibility,
    )

    react_router_bin.react_router_binary(
        name = "dev",
        data = srcs,
        args = ["dev", "."],
        chdir = native.package_name(),
        visibility = visibility,
    )

    vite_bin.vite_binary(
        name = "start",
        data = [":build"] + srcs,
        args = [
            "preview",
            ".",
            "--host",
            "localhost",
            "--outDir",
            "build/client",
        ],
        chdir = native.package_name(),
        visibility = visibility,
    )

    native.alias(
        name = name,
        actual = "build",
        visibility = visibility,
    )
