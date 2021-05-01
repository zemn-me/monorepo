/**
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/next-server/lib/constants.ts#L1-L4
 */
const constants = require('next/constants')

const getName = (v) => {
	let name = v.desc || v.name
	if (!name) name = v.toString()
	return name
}

const guardPluginReturnsUndefined = (plugin) => {
	const ret = (...params) => {
		const ret = plugin(...params)
		if (ret === undefined)
			throw new Error(`Plugin ${getName(plugin)} returned undefined`)
		return ret
	}

	ret.desc = getName(plugin)
	return ret
}

const chainOne = (first, next) => {
	const ret = (phase, { defaultConfig, ...propEtc }, ...etc) => {
		console.info('chainOne: exec plugin', getName(first))
		const newConfig = first(phase, { defaultConfig, ...propEtc }, ...etc)
		console.info('chainOne: exec plugin', getName(next))
		return next(phase, { defaultConfig: newConfig, ...propEtc }, ...etc)
	}
	ret.desc = `chainOne(${getName(first)}, ${getName(next)})`
	return ret
}

const phase = (config, phase) => {
	const ret = (realPhase, { defaultConfig, ...confProps }, ...etc) => {
		if (phase !== realPhase) return defaultConfig
		return config(realPhase, { defaultConfig, ...confProps }, ...etc)
	}

	ret.desc = `phase(${getName(config)}, ${phase})`
	return ret
}

const chain = (...plugins) => {
	let config
	for (let plugin of plugins) {
		plugin = guardPluginReturnsUndefined(plugin)
		console.log('chain: installing plugin', getName(plugin))
		config = config !== undefined ? chainOne(config, plugin) : plugin
	}
	return config
}

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

function cssMinifierPlugin(phase, { defaultConfig: config }) {
	return {
		...config,
		webpack(wpcfg, ...a) {
			wpcfg.module.rules[1].oneOf.forEach((moduleLoader) => {
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
	}
}

const ClosurePlugin = require('closure-webpack-plugin')

function closureCompilerPlugin(phase, { defaultConfig: config }) {
	return {
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
	}
}

function xdmPlugin(phase, { defaultConfig: config }) {
	return {
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
	}
}

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

function baseConfig(phase, { defaultConfig: config }) {
	return {
		...config,
		generateBuildId: () =>
			require('next-build-id')({
				dir: __dirname,
				describe: true,
			}),
		webpack: (wpcfg, options, ...a) => {
			const { isServer } = options
			// Fixes npm packages that depend on `fs` module
			if (!isServer) {
				wpcfg.node = {
					fs: 'empty',
				}
			}

			if (config.webpack) wpcfg = config.webpack(config, options, ...a)
			return wpcfg
		},
	}
}

/*const printConfigSetup = (
	phase,
	{ defaultConfig: config, ...propEtc },
	...paramEtc
) => {
	console.info('phase', phase)
	console.info('config', config)
	console.info('propEtc', propEtc)
	console.info('paramEtc', paramEtc)
	return config
}*/

module.exports = chain(
	baseConfig,
	phase(closureCompilerPlugin, constants.PHASE_PRODUCTION_BUILD),
	phase(cssMinifierPlugin, constants.PHASE_PRODUCTION_BUILD),
	xdmPlugin,
)
