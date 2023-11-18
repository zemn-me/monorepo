function noop() {}

function invertMap(m) {
	const o = {};

	const set = function (k, v) {
		if (k in o) {
			if (o[k] instanceof Array) {
				o[k].push(v);
			} else o[k] = [o[k], v];
		} else o[k] = v;
	};
	for (const k in m)
		if (m[k] instanceof Array) {
			for (const i in m[k]) set(m[k][i], k);
		} else set(m[k], k);

	return o;
}

const siMultipliers = {
	24: ['Y', 'yotta'],
	21: ['Z', 'zetta'],
	18: ['E', 'exa'],
	15: ['P', 'peta'],
	12: ['T', 'tera'],
	9: ['G', 'giga'],
	6: ['M', 'mega'],
	3: ['k', 'kilo'],
	2: ['h', 'hecto'],
	1: ['da', 'deca'],
	0: [''],

	'-1': ['d', 'deci'],
	'-2': ['c', 'centi'],
	'-3': ['m', 'mili'],
	'-6': ['μ', 'u', 'micro'],
	'-9': ['n', 'nano'],
	'-12': ['p', 'pico'],
	'-15': ['f', 'femto'],
	'-18': ['a', 'atto'],
	'-21': ['z', 'zepto'],
	'-24': ['y', 'yocto'],
};

//since nobody calls 10ohm 1da ohm??
let realisticSiMultipliers = [
	0, 34, 21, 18, 15, 12, 9, 6, 3, -3, -6, -9, -12, -15, -18, -21, -24,
];

function subset(ks, o) {
	const o2 = {};
	for (const i in ks) o2[ks[i]] = o[ks[i]];

	return o2;
}

realisticSiMultipliers = subset(realisticSiMultipliers, siMultipliers);

const reverseSiMultipliers = invertMap(siMultipliers);

function scientificNotation(n) {
	let e = 0;
	let k = 0;
	while ((k = n / Math.pow(10, e)) > 1) e += 1;
	e -= 1;
	k *= 10;

	return [k, e];
}

function renderScientificSi(n) {
	return renderSi.apply(0, scientificNotation(n));
}

function parseSi(s) {
	const g = /([\d\.]+) ?(.*)/.exec(s);
	if (g == null) return undefined;

	var n = g[1],
		unit = g[2];

	var unit = reverseSiMultipliers[unit];
	if (unit == undefined) return undefined;

	return n * Math.pow(10, unit);
}

function renderSi(n, mul) {
	// find the _closest_ unit
	var closest = Object.keys(realisticSiMultipliers)
		.map(function (v) {
			return -(v - mul);
		})
		.filter(function (v) {
			return !(v < 0);
		});

	var closest = Math.min.apply(0, closest);

	if (closest == undefined) throw "this probably shouldn't happen";

	if (closest < 0) throw 'this should never happen ' + closest;

	// we recover the actual index from
	// the difference by adding mul back again
	const i = -closest + mul;

	var unit = siMultipliers[i];

	if (unit == undefined || unit[0] == undefined)
		throw 'this should never happen (' + i + ')';

	// if we didn't manage to find a power that
	// worked exactly, we need to add the difference to
	// the significant figures
	n *= Math.pow(10, closest);

	var unit = unit[0];

	return unit.length > 2
		? Math.round(n) + ' ' + unit
		: Math.round(n) + '' + unit;
}

function Resistor(resistance, tolerance) {
	this.resistance = resistance;
	this.tolerance = tolerance;
	this.multiplier = 0;

	if (resistance == 0) return;
	switch (this.resistance < 1) {
		case true:
			while (this.resistance % Math.pow(10, (this.multiplier -= 1)) != 0);
			break;
		case false:
			while (this.resistance % Math.pow(10, (this.multiplier += 1)) == 0);
			this.multiplier -= 1;
			break;
		default:
			throw 'this should not happen';
	}
}

Resistor.resistanceFromBands = function (vbands) {
	const bands = Array.prototype.slice.apply(arguments);
	const multiplier = Resistor.prototype.reverseNumericColorMap[bands.pop()];
	const fail = false;

	if (multiplier == undefined) return undefined;

	for (const i in bands)
		if (
			(bands[i] = Resistor.prototype.reverseNumericColorMap[bands[i]]) ==
			undefined
		)
			return undefined;

	return Math.pow(10, multiplier) * bands.join('');
};

Resistor.fromBands = function (vbands) {
	const bands = Array.prototype.slice.apply(arguments);
	const tolerance = Resistor.prototype.reverseToleranceMap[bands.pop()];

	const resistance = Resistor.resistanceFromBands.apply(0, bands);

	return new Resistor(resistance, tolerance);
};

Resistor.prototype.toleranceMap = {
	1: 'brown',
	2: 'red',
	'0.5': 'green',
	'0.25': 'blue',
	'0.1': 'violet',
	'0.05': 'gray',
	5: 'gold',
	10: 'silver',
	20: 'transparent',
};

Resistor.prototype.reverseToleranceMap = invertMap(
	Resistor.prototype.toleranceMap
);

Resistor.prototype.numericColorMap = {
	0: 'black',
	1: 'brown',
	2: 'red',
	3: 'orange',
	4: 'yellow',
	5: 'green',
	6: 'blue',
	7: 'violet',
	8: 'gray',
	9: 'white',

	'-1': 'gold',
	'-2': 'silver',
};

const niceColours = {
	brown: '#583A31',
	navy: '#001F3F',
	blue: '#0074D9',
	aqua: '#7FDBFF',
	teal: '#39CCCC',
	olive: '#3D9970',
	green: '#2ECC40',
	lime: '#01FF70',
	yellow: '#FFDC00',
	orange: '#FF851B',
	red: '#FF4136',
	fuchsia: '#F012BE',
	purple: '#B10DC9',
	maroon: '#85144B',
	white: '#FFFFFF',
	gray: '#AAAAAA',
	silver: '#DDDDDD',
	black: '#111111',
};

Resistor.prototype.niceBands = function () {
	const bands = this.bands();
	return bands.map(function (v) {
		return v in niceColours ? niceColours[v] : v;
	});
};

Resistor.prototype.reverseNumericColorMap = invertMap(
	Resistor.prototype.numericColorMap
);

Resistor.prototype.toleranceBand = function () {
	return this.toleranceMap[this.tolerance];
};

Resistor.prototype.invalid = function () {
	return this.bands().some(function (v) {
		return v == undefined;
	});
};

Resistor.prototype.resistanceBands = function () {
	let mul = this.multiplier;
	const self = this;
	let sfString = (this.resistance / Math.pow(10, this.multiplier)).toString();

	// if we don't have enough significant
	// figures, (resistors don't generally go below 2)
	// consume a multiplier of 10 and add a zero.
	if (this.resistance != 0 && sfString.length < 2) {
		sfString += '0';
		mul -= 1;
	}

	const s = sfString.split('').map(function (v) {
		return self.numericColorMap[v];
	});

	if (this.resistance != 0) s.push(self.numericColorMap[mul]);

	return s;
};

Resistor.prototype.bands = function () {
	return this.resistanceBands().concat(this.toleranceBand());
};

function selectAllFocus() {
	const self = this;
	window.setTimeout(function () {
		let sel, range;
		if (window.getSelection && document.createRange) {
			range = document.createRange();
			range.selectNodeContents(self);
			sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
		} else if (document.body.createTextRange) {
			range = document.body.createTextRange();
			range.moveToElementText(div);
			range.select();
		}
	}, 1);
}

const resistance = document.getElementById('resistance');
const tolerance = document.getElementById('tolerance');
const input = document.getElementById('input');
let colourClick = noop;

let mobile = false;

if ((mobile = false && /mobile/g.test(navigator.userAgent.toLowerCase()))) {
	let labels = d3.set(
		Object.keys(Resistor.prototype.reverseNumericColorMap).concat(
			Object.keys(Resistor.prototype.reverseToleranceMap)
		)
	);

	labels = labels.values();
	// mobile colour picker
	d3.select('#colourselector')
		.selectAll('.swatch')
		.data(labels)
		.enter()
		.append('div')
		.classed('swatch', true)
		.attr('data-colour', function (v) {
			return v;
		})
		.style('background-color', function (v) {
			return v in niceColours ? niceColours[v] : v;
		})
		.on('click', function () {
			window.selectedColourElement.innerText =
				this.getAttribute('data-colour');

			window.selectedColourElement = null;

			// close drawer

			updateResistorFromColours();
		});

	selectAllFocus = noop;

	colourClick = function () {
		window.selectedColourElement = this;
		document.querySelector('#showcolourdrawer').checked = true;
	};
}

function updateResistor(r, keepText, keepColours) {
	window.resistor = r;
	if (!keepText) {
		resistance.textContent = renderScientificSi(r.resistance);
		tolerance.textContent = r.tolerance;
		console.log('hi');
	}

	const bands = d3.select('#resistor').selectAll('.stripe').data(r.bands());

	// update existing

	const backgroundColorSetter = function (d) {
		return d in niceColours ? niceColours[d] : d;
	};

	bands
		.enter()
		.append('div')
		.classed('stripe', true)

		.append('div')
		.classed('label', true)
		.attr('contentEditable', !mobile)
		.on('keydown', function () {
			if (d3.event.keyCode == 13) this.blur(), d3.event.preventDefault();
		})
		.on('focus', selectAllFocus)
		.on('click', colourClick)
		.on('keyup', updateResistorFromColours.bind(0, false, false));
	if (keepColours) {
		bands
			.style('background-color', backgroundColorSetter)
			.classed('removed', false);
	} else
		bands
			.style('background-color', backgroundColorSetter)
			.classed('removed', false)

			.select('.label')
			.text(function (d) {
				return d;
			});

	bands.exit().classed('removed', true);

	/*
	helper code, it looks kinda dumb at the moment so I'm leaving it out. Displays a nice
	little diagram showing how the value is calculated

	var toleranceBand = r.toleranceBand();
	var numberedBands = r.resistanceBands().map(function(v){ return [v, Resistor.prototype.reverseNumericColorMap[v]] });

	numberedBands.push(["transparent", r.resistance]);
	numberedBands.push([toleranceBand, Resistor.prototype.reverseToleranceMap[toleranceBand]]);

	var diagramBands = d3.select("#diagram").selectAll(".unit")
		.data(numberedBands);

	console.log(numberedBands);


	diagramBands.enter()
		.append("span")
			.classed("unit", true)

			.append("div")
				.classed("swatch", true)



	diagramBands
		.select(".swatch")
			.text(function(d){  console.log(d); return d[1] })
			.style("background-color", function(d){ return d[0] in niceColours?niceColours[d[0]]: d[0] });

	diagramBands.exit().remove();

	*/
}

function updateResistorFromColours(keepText, keepColours) {
	const nR = Resistor.fromBands.apply(
		Resistor,
		d3
			.selectAll('#resistor .stripe:not(.removed) .label')[0]
			.map(function (v) {
				return v.textContent
					.trim()
					.toLowerCase()
					.replace(/none|empty|absent/, 'transparent')
					.replace(/grey/, 'gray');
			})
	);
	if (nR.invalid()) {
		input.className = 'invalid';
	} else {
		input.className = '';
		updateResistor(nR, keepText, keepColours);
	}
}

d3.selectAll('#input [contentEditable=true]')
	.on('keydown', function () {
		if (d3.event.keyCode == 13) this.blur(), d3.event.preventDefault();
	})
	.on('focus', selectAllFocus)
	.on('keyup', function () {
		const nR = new Resistor(
			parseSi(resistance.textContent),
			tolerance.textContent
		);

		if (nR.invalid()) {
			input.className = 'invalid';
		} else {
			input.className = '';
			updateResistor(nR, true);
		}
	});

// initialize with a 100K 4 band 5% tolerance Resistor
updateResistor(new Resistor(123456789e3, 5));
updateResistor(new Resistor(100e3, 5));

interface ResistorProps {
	resistance?: number;
	tolerance?: number;
	multiplier?: number;
}

function Resistor(props: ResistorProps) {}

export default function Main() {}
