
const ident = x => x;

const uniqueClass = (() => {
    let ctr = 0;
    const identsMap = new Map();
    return (context, _, localName) => {
        const key = [context.resourcePath, localName].join("__");
        identsMap.set(key, identsMap.get(key) || ctr++);
        return `c${identsMap.get(key).toString(32)}`
    }
})()

const cssMinifierPlugin = config => ({
    ...config,
    webpack(wpcfg, ...a) {
		wpcfg.module.rules[1].oneOf.forEach((moduleLoader, i) => {
			Array.isArray(moduleLoader.use) && moduleLoader.use.forEach((l) => {
				if(l.loader.includes("css-loader")) {
					l.options = {
						...l.options,
                        modules: {
                            ...l.options.modules,
                            ...(
                                 //{ getLocalIdent: uniqueClass }
                                {}
                            )
                        }
					}
                }
			});
        });
        
        wpcfg.node = { fs: "empty" };
        if (config.webpack) wpcfg = config.webpack(wpcfg, ...a);
        return wpcfg;
    }
});


const mdxPlugin = config => {
    config = require('next-mdx-enhanced')({
        remarkPlugins: [
            require('remark-validate-links'),
            require('remark-sub-super'),
            require('remark-heading-id'),
            require('remark-footnotes'),
            require('remark-lint-no-undefined-references'),
            require('remark-lint-no-heading-like-paragraph'),
            [require('remark-captions'), {
                internal: {
                    image: 'Figure:'
                }
            }],
            require('@silvenon/remark-smartypants'),
            [require('remark-textr'), {
                plugins: [
                    require('typographic-apostrophes'),
                    require('typographic-quotes'),
                    /*[require('typographic-quotes'), { locale: 'en-GB' }],*/
                    require('typographic-quotes'),
                    require('typographic-arrows'),
                    require('typographic-copyright'),
                    require('typographic-ellipses'),
                    require('typographic-em-dashes'),
                    require('typographic-en-dashes'),
                    require('typographic-math-symbols'),
                    require('typographic-registered-trademark'),
                    require('typographic-trademark')
                ]
            }],
            require('./sectionize.js'),
        ],
    })(config);

    return config;
}

const plugin = config => {
    config = require('next-videos')({
        // i cannot explain why this makes it work, but it does
        assetDirectory: 'static',
        ...config
    });

    config = require('next-images')(config);

    config = mdxPlugin(config);
    config = cssMinifierPlugin(config);

    return config;
}

module.exports = {
    plugin,
    default: plugin
}