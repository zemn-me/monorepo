const glob = require('glob');
const fs = require('fs').promises;
const path = require('path');

const fontName = 'EB Garamond';

const weightName = n => {
	const weights = {
		'-Regular': 400,
		'-Medium': 500,
		'-SemiBold': 600,
		'-Bold': 700,
	};

	for (const [name, val] of Object.entries(weights)) {
		if (n.indexOf(name) != -1) return val;
	}

	return weights['-Regular'];
};

const formatName = n =>
	({
		ttf: 'truetype',
		woff: 'woff',
		otf: 'opentype',
	}[n] || n);

(async function main() {
	process.chdir(__dirname);
	const files = await new Promise((ok, fail) =>
		glob(`./EBGaramond12/fonts/*/*`, {}, (err, files) => {
			return err ? fail(err) : ok(files);
		})
	);

	// collate different font formats
	const m = new Map();
	for (const file of files) {
		const key = path.basename(file, path.extname(file));
		m.set(key, (m.get(key) || []).concat(file));
	}

	const defs = [...m]
		.map(([name, fonts]) => {
			return `
@font-face {
    font-family: '${fontName}';
    font-style: ${name.endsWith('Italic') ? 'italic' : 'normal'};
    font-display: swap;
    font-weight: ${weightName(name)};
    src:
        local('${name}'),
        ${fonts
			.map(
				f =>
					`url(${f}) format('${formatName(
						path.extname(f).slice(1)
					)}')`
			)
			.join(',\n')};
}
        `;
		})
		.join('\n');

	await fs.writeFile('index.css', defs);
})().catch(e => console.error(e));
