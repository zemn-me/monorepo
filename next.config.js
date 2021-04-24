/**
 * Adapts plugins that just operate on an input object
 * to the function form.
 */
const simplePlugin = (plugin) =>
	// prev plugin, and arbitrary args
	(lastPlugin, ...a) =>
		// plugin function form
		(...pluginParams) =>
			// pass the result of the last plugin to our plugin
			plugin(lastPlugin(...pluginParams), ...a)

const ramp = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'
class BaseConverter {
	constructor(ramp) {
		this.ramp = ramp
	}
	get zero() {
		return this.ramp[0]
	}
	get base() {
		return this.ramp.length
	}
	reverse(s) {
		return [...s]
			.map((ch, i) => this.value(ch, i))
			.reduce((a, c) => a + c, 0)
	}
	convert(n) {
		let o = []
		for (;;) {
			const remainder = n % this.base
			n = Math.floor(n / this.base)

			o.push(this.ramp[remainder])

			if (n === 0) break
		}

		return o.reverse().join('')
	}
}

const cssMinifierPlugin = simplePlugin((config) => ({
	...config,
	webpack(wpcfg, ...a) {
		wpcfg.module.rules[1].oneOf.forEach((moduleLoader, i) => {
			Array.isArray(moduleLoader.use) &&
				moduleLoader.use.forEach((l) => {
					if (l.loader.includes('css-loader')) {
						l.options = {
							...l.options,
							modules: {
								...l.options.modules,
								...{ getLocalIdent: uniqueClass },
								//{}
							},
						}
					}
				})
		})

		wpcfg.node = { fs: 'empty' }
		if (config.webpack) wpcfg = config.webpack(wpcfg, ...a)
		return wpcfg
	},
}))

const ClosurePlugin = require('closure-webpack-plugin')

const closureCompilerPlugin = simplePlugin((config) => ({
	...config,
	webpack(wpcfg, ...a) {
		wpcfg = {
			...wpcfg,
			optimization: {
				...wpcfg.optimization,
				minimizer: [
					...wpcfg.optimization.minimizer,
					new ClosurePlugin({ mode: 'STANDARD' }, {}),
				],
			},
		}
		if (config.webpack) wpcfg = config.webpack(wpcfg, ...a)
		return wpcfg
	},
}))

const xdmPlugin = simplePlugin((config) => ({
	...config,
	pageExtensions: [...(config.pageExtensions || []), 'mdx'],
	webpack(wpcfg, options, ...a) {
		wpcfg = {
			...wpcfg,
			module: {
				...wpcfg.module,
				rules: [
					...wpcfg.module.rules,
					{
						test: /\.mdx$/,
						use: [{ loader: 'xdm/webpack.cjs', options: {} }],
					},
				],
			},
		}

		if (config.webpack) wpcfg = config.webpack(wpcfg, options, ...a)
		return wpcfg
	},
}))

const conv = new BaseConverter(ramp)

const uniqueClass = (() => {
	let ctr = 0
	const identsMap = new Map()
	return (context, _, localName) => {
		const key = [context.resourcePath, localName].join('__').trim()
		const v = identsMap.get(key)
		identsMap.set(key, v == undefined ? ctr++ : v)
		return conv.convert(identsMap.get(key))
	}
})()

const identityPlugin = simplePlugin((a) => a)

const productionOnly = (plugin) => {
	if (process.env.NODE_ENV !== 'production') return identityPlugin
	return plugin
}

const baseConfig = simplePlugin((config) => ({
	...config,
	generateBuildId: () =>
		require('next-build-id')({
			dir: __dirname,
			describe: true,
		}),
	webpack: (config, options, ...a) => {
		const { isServer } = options
		// Fixes npm packages that depend on `fs` module
		if (!isServer) {
			config.node = {
				fs: 'empty',
			}
		}

		if (config.webpack) wpcfg = config.webpack(config, options, ...a)
		return config
	},
}))

module.exports = (phase, { defaultConfig }) => defaultConfig
module.exports = baseConfig(module.exports)
module.exports = productionOnly(cssMinifierPlugin)(module.exports)
module.exports = productionOnly(closureCompilerPlugin)(module.exports)
module.exports = xdmPlugin(module.exports)
