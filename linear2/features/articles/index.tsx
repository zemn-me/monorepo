import * as unist from 'unist'
import child_process from 'child_process'
import Path from 'path'
import glob from 'glob'
import parse from 'linear2/features/jmdx/parse'
import util from 'util'
import visit from 'unist-util-visit'
import * as mdast from 'mdast'
import VFile from 'vfile'
import Fs from 'fs'
//import spawn from 'cross-spawn';

class Struct<T> {
	value: T
	valueOf() {
		return this.value
	}
	constructor(v: T) {
		this.value = v
	}
}

async function attempt<I extends unknown[], O>(
	message: string,
	f: (...i: I) => O,
	...p: I[]
): Promise<[O, I]> {
	let errors: unknown[] = []
	for (const params of p) {
		try {
			return [await f(...params), params]
		} catch (e) {
			errors.push(e)
		}
	}

	throw new MultiError(errors, message)
}

type Path = ReturnType<typeof Path.parse>
function withExt(ext: string, p: Path): Path {
	return {
		...p,
		base: p.base + ext,
		ext: ext,
	}
}

type Tail<T extends unknown[]> = T extends [unknown, ...infer Z] ? Z : never

type Assert<A, B extends A> = A
type _t = Assert<[2, 3], Tail<[1, 2, 3]>>
// @ts-expect-error
type _t2 = Assert<[2, 3, 4], Tail<[1, 2, 3]>>

const newPath = Path.posix.parse
const toPathStrings = (...p: readonly Readonly<Path>[]) =>
	p.map((p) => Path.format(p))
const resolve = (...p: readonly Readonly<Path>[]) =>
	Path.parse(Path.resolve(...toPathStrings(...p)))

export class Article extends Struct<{
	dirPath?: Path
	filePath?: Path
	content?: string | Buffer
	vfile?: VFile.VFile
	ast?: unist.Node
	titles?: (mdast.Heading & { depth: 1 })[]
}> {
	private static pReadFile = util.promisify(Fs.readFile)

	private static async readFile(
		path: Readonly<Path>,
		...etc: Tail<Parameters<typeof Article.pReadFile>>
	) {
		return Article.pReadFile(Path.format(path), ...etc)
	}

	get dirPath() {
		return resolve(Path.parse(process.cwd()), this.value.dirPath!)
	}

	private static async filePathAndContent(target: Readonly<Path>) {
		const tailParams = ['utf8'] as const
		const extensions = ['.mdx', '.md'] as const
		const indexPaths = [newPath('.'), newPath('./index')] as const
		let tries: Parameters<typeof Article.readFile>[] = []

		for (const ext of extensions) {
			for (const indPath of indexPaths) {
				tries.push([
					withExt(ext, resolve(target, indPath)),
					...tailParams,
				])
			}
		}

		return attempt('loadFile', Article.readFile, ...tries)
	}

	get filePath() {
		return this.value.filePath === undefined
			? (async () => {
					const [file, [path]] = await Article.filePathAndContent(
						this.dirPath!,
					)

					this.value.filePath = path
					this.value.content = await file
					return this.value.filePath
			  })()
			: this.value.filePath
	}

	get content() {
		return this.value.content === undefined
			? (async () => {
					const [file, [path]] = await Article.filePathAndContent(
						this.dirPath!,
					)

					this.value.filePath = path
					this.value.content = await file
					return this.value.content
			  })()
			: this.value.content
	}

	get vfile() {
		return this.value.vfile === undefined
			? (async () => {
					const [path, contents] = [
						await this.filePath,
						await this.content,
					]
					return VFile({ path: Path.format(path), contents })
			  })()
			: this.value.vfile
	}

	get ast() {
		return this.value.ast === undefined
			? (async () => await parse(await this.vfile))()
			: this.value.ast
	}

	get titles() {
		return this.value.titles === undefined
			? (async () => {
					const titles: (mdast.Heading & { depth: 1 })[] = []
					visit<mdast.Heading & { depth: 1 }>(
						(await this.ast) as unist.Node,
						(node: unknown): node is mdast.Heading & { depth: 1 } =>
							(node as unist.Node).type == 'heading' &&
							(node as unist.Node).depth == 1,
						(node) => titles.push(node),
					)

					return titles
			  })()
			: this.value.titles
	}

	get title() {
		return (async () => {
			const [title = undefined] = await this.titles
			if (title) return { type: 'root', children: title.children }
			return { type: 'text', value: 'Untitled' }
		})()
	}

	get edits() {
		return (async () => {
			const { stdout } = await util.promisify(
				child_process.execFile,
			)('git', [
				'--no-pager',
				'log',
				'--pretty=format:%ci',
				Path.format(await this.filePath!),
			])

			const dates = stdout

			return dates.split('\n').map((d) => Date.parse(d))
		})()
	}

	async toJSON() {
		const { title, edits, titles, ast, content, filePath } = this
		return {
			title: await title,
			edits: await edits,
			titles: await titles,
			ast: await ast,
			content: await content,
			filePath: await filePath,
		}
	}
}

class MultiError extends Error {
	errors: unknown[]
	constructor(errors: unknown[], message?: string) {
		super(
			`multiple errors in ${message}: ${errors
				.map((e) => `${e}`)
				.join(', ')}`,
		)
		if (Error.captureStackTrace) Error.captureStackTrace(this, MultiError)
		this.errors = errors
		this.name = 'MultiError'
	}
}

export async function In(...basePath: string[]) {
	return (
		await new Promise<string[]>((ok, fail) =>
			glob(
				Path.posix.join(process.cwd(), ...basePath, '**/*.@(mdx|md)'),
				(err, files) => {
					if (err) return fail(err)
					return ok(files)
				},
			),
		)
	)
		.map((p) => ({ web: p.slice(0, -Path.extname(p).length), local: p }))
		.map(({ web, ...etc }) => ({
			...etc,
			web: Path.relative(
				Path.join(process.cwd(), 'pages', 'article'),
				web,
			),
		}))
		.map(({ web, ...etc }) => ({
			...etc,
			web: web.split(Path.sep).join(Path.posix.sep),
		}))
		.map(({ web, ...etc }) => {
			const basename = Path.posix.basename(web)
			if (basename == 'index') web = Path.posix.join(web, '..')
			return { ...etc, web }
		})
}

export const pathsIn = async (...basePath: string[]) => {
	const r = {
		paths: (await In(...basePath)).map(({ web }) => ({
			params: { path: web.split(Path.posix.sep) },
		})),

		fallback: false,
	}

	return r
}

export const articlesAndPathsIn = async (...basePath: string[]) => {
	const articlePaths = await pathsIn(...basePath)
	return await Promise.all(
		articlePaths.paths.map(async (path) => {
			const article = await new Article({
				dirPath: Path.parse(
					Path.join('pages', 'article', ...path.params.path),
				),
			})
			const { title, edits } = article
			return { ...path, title: await title, edits: await edits }
		}),
	)
}
