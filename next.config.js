const production = process.env.NODE_ENV == "production";
const glob = require("glob");
const path = require("path");

const domain = new URL(production?
    "https://zemn.me": "http://localhost:3000");


const uniqIdent = (() => {
    let ctr = 0;
    const identsMap = new Map();
    return (context, _, localName) => {
        const key = [ context.resourcePath, localName ].join("__");
        identsMap.set(key, identsMap.get(key) || ctr++);
        return `c${identsMap.get(key).toString(32)}`
    }
})()

const base_config = {
    generateBuildId: () => require('next-build-id')({
        dir: __dirname,
        describe: true
    }),
    env: {
        origin: domain.origin,
        protocol: domain.protocol,
        routes: glob.sync("pages/**/*.@(mdx|tsx)").map(
            v => {
                if (/\w+.(?:mdx|tsx)$/g.test(v)) return path.dirname(v); 

                return v.slice(0, -path.extname(v).length)
            }
        ).map(v => "/" + v.slice("pages/".length))
    }
};


let config = base_config;
config = require('next-mdx-enhanced')({
    remarkPlugins: [
        require('remark-validate-links'),
        require('remark-sub-super'),
        require('remark-heading-id'),
        require('remark-footnotes'),
        require('@silvenon/remark-smartypants'),
        [require('remark-textr'), { plugins: [
            require('typographic-apostrophes'),
            require('typographic-quotes'),
            require('typographic-arrows'),
            require('typographic-copyright'),
            require('typographic-ellipses'),
            require('typographic-em-dashes'),
            require('typographic-en-dashes'),
            require('typographic-math-symbols'),
            require('typographic-registered-trademark'),
            require('typographic-trademark')
        ] }],
    ],
})(config);

config = require('next-images')(config);
config = require('next-videos')(config);

const mdxOpts = {
    // https://github.com/frontarm/mdx-util/blob/d236b4a805e5cfc656b6851a0e707a9d26cf0d29/packages/mdx-loader/index.js#L30
    compilers: [
        require('mdx-table-of-contents')
    ],
};

module.exports = {
    ...config,
	webpack(conf, ...a) {
		conf.module.rules[1].oneOf.forEach((moduleLoader, i) => {
			Array.isArray(moduleLoader.use) && moduleLoader.use.forEach((l) => {
				if(l.loader.includes("css-loader")) {
					l.options = {
						...l.options,
                        modules: {
                            ...l.options.modules,
                            ...(
                                production
                                ? { getLocalIdent: uniqIdent }
                                : {}
                            )
                        }
					}
                }
                
			});
        });
        
        conf.node = { fs: "empty" };
        const c = config.webpack(conf, ...a);
        // now, with the config modified we can make our own changes...

        conf.module.rules.forEach(( rule ) => {
            if (!rule.use) return;
            if (!rule.use.forEach) return;
            rule.use.forEach(useConf => {
                if (!useConf.loader) return;
                if ( !useConf.loader.includes("@mdx-js/loader") ) return;

                /*
                useConf.options = {
                    ...useConf.options,
                    ...mdxOpts
                }
                */

                console.log(useConf);


            })
        })
        return c
	}, 
}