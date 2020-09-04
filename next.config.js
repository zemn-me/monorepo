const production = process.env.NODE_ENV == "production";

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
        protocol: domain.protocol
    }
};


let config = base_config;
config = require('next-mdx-enhanced')({
    remarkPlugins: [
        require('remark-validate-links'),
        require('remark-sub-super'),
        [require('remark-textr'), { plugins: [
            require('typographic-base')
        ] }]
    ]
})(config);

config = require('next-images')(config);
config = require('next-videos')(config);

module.exports = {
    ...config,
	webpack(conf, ...a) {
		conf.module.rules[1].oneOf.forEach((moduleLoader, i) => {
			Array.isArray(moduleLoader.use) && moduleLoader.use.forEach((l) => {
				if(l.loader.includes("css-loader")) {
					l.options = {
						...l.options,
                        modules: {
                            ...(
                                production
                                ? { getLocalIdent: uniqIdent}
                                : {}
                            )
                        }
					}
				}
			});
		});
        conf.node = { fs: "empty" };
		return config.webpack(conf, ...a);
	}, 
}