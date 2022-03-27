# React Server Rules

These are a set of rules that allow 'single page site' React apps to be built.

The main rule is [web_app], which takes a set of web resources and bundles them appropriately for a few targets:

     - NAME_prod: minified, compressed etc targets
        - NAME_prod_run: run a target as a production site (or close enough to it)
        - NAME_prod_build: build all the sources (TS, JS and CSS)
        - NAME_prod_bundle: build all buildable sources and bundles them with other sources (like index.html)
    - NAME_dev: hastily compiled targets for dev
        - NAME_dev_run: run a target in dev mode (as a web server)
        - NAME_prod_build: build all the sources in dev mode
        - NAME_prod_bundle: bundle all the sources in dev mode


[web_app]: ./rules.bzl#L4