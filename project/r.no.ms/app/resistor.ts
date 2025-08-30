// Utility functions for resistor calculations without relying on D3 for DOM work

function invertMap<K extends string | number, V>(
  m: Record<K, V | V[]>,
): Record<string, K | K[]> {
  const o: Record<string, K | K[]> = {};
  const set = (k: string, v: K) => {
    if (k in o) {
      const existing = o[k];
      if (Array.isArray(existing)) {
        existing.push(v);
      } else {
        o[k] = [existing, v];
      }
    } else {
      o[k] = v;
    }
  };
  for (const k in m) {
    const val = m[k];
    if (Array.isArray(val)) {
      for (const v of val) set(v, k);
    } else set(val, k);
  }
  return o;
}

const siMultipliers: Record<string | number, string[]> = {
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

// since nobody calls 10ohm 1da ohm??
let realisticSiMultipliers = [0, 24, 21, 18, 15, 12, 9, 6, 3, -3, -6, -9, -12, -15, -18, -21, -24];

function subset<K extends string | number, V>(ks: K[], o: Record<K, V>): Record<K, V> {
  const o2 = {} as Record<K, V>;
  for (const k of ks) o2[k] = o[k];
  return o2;
}

realisticSiMultipliers = subset(realisticSiMultipliers, siMultipliers);

const reverseSiMultipliers = invertMap(siMultipliers);

function scientificNotation(n: number): [number, number] {
  let e = 0;
  let k = 0;
  while ((k = n / Math.pow(10, e)) > 1) e += 1;
  e -= 1;
  k *= 10;
  return [k, e];
}

function renderScientificSi(n: number): string {
  return renderSi(...scientificNotation(n));
}

function parseSi(s: string): number | undefined {
  const g = /([\d\.]+) ?(.*)/.exec(s);
  if (g == null) return undefined;
  const n = g[1];
  const unitStr = g[2];
  const unit = reverseSiMultipliers[unitStr];
  if (unit == undefined) return undefined;
  return Number(n) * Math.pow(10, Number(unit));
}

function renderSi(n: number, mul: number): string {
  const closestArr = Object.keys(realisticSiMultipliers)
    .map(v => -(Number(v) - mul))
    .filter(v => !(v < 0));
  const closest = Math.min(...closestArr);
  if (closest === undefined) throw new Error('this probably should not happen');
  if (closest < 0) throw new Error(`this should never happen ${closest}`);
  const i = -closest + mul;
  const unit = siMultipliers[i];
  if (unit == undefined || unit[0] == undefined) throw new Error(`this should never happen (${i})`);
  const u = unit[0];
  return u.length > 2 ? Math.round(n) + ' ' + u : Math.round(n) + '' + u;
}

const niceColours: Record<string, string> = {
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

export class Resistor {
  resistance: number;
  tolerance: number;
  multiplier: number;

  static toleranceMap: Record<string | number, string> = {
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

  static reverseToleranceMap = invertMap(Resistor.toleranceMap);

  static numericColorMap: Record<string | number, string> = {
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

  static reverseNumericColorMap = invertMap(Resistor.numericColorMap);

  constructor(resistance: number, tolerance: number) {
    this.resistance = resistance;
    this.tolerance = tolerance;
    this.multiplier = 0;
    if (resistance === 0) return;
    switch (this.resistance < 1) {
      case true:
        while (this.resistance % Math.pow(10, (this.multiplier -= 1)) !== 0) {
          /* empty */
        }
        break;
      case false:
        while (this.resistance % Math.pow(10, (this.multiplier += 1)) === 0) {
          /* empty */
        }
        this.multiplier -= 1;
        break;
      default:
        throw new Error('this should not happen');
    }
  }

  static resistanceFromBands(...vbands: string[]): number | undefined {
    const bands = [...vbands];
    const multiplier = Resistor.reverseNumericColorMap[bands.pop()!];
    if (multiplier === undefined) return undefined;
    for (let i = 0; i < bands.length; i++) {
      const v = Resistor.reverseNumericColorMap[bands[i]];
      if (v === undefined) return undefined;
      bands[i] = String(v);
    }
    return Math.pow(10, Number(multiplier)) * Number(bands.join(''));
  }

  static fromBands(...vbands: string[]): Resistor {
    const bands = [...vbands];
    const tolerance = Resistor.reverseToleranceMap[bands.pop()!];
    const resistance = Resistor.resistanceFromBands(...bands) ?? 0;
    return new Resistor(resistance, Number(tolerance));
  }

  toleranceBand(): string | undefined {
    return Resistor.toleranceMap[this.tolerance];
  }

  resistanceBands(): string[] {
    let mul = this.multiplier;
    let sfString = (this.resistance / Math.pow(10, this.multiplier)).toString();
    if (this.resistance !== 0 && sfString.length < 2) {
      sfString += '0';
      mul -= 1;
    }
    const s = sfString
      .split('')
      .map(v => Resistor.numericColorMap[v as keyof typeof Resistor.numericColorMap]);
    if (this.resistance !== 0) {
      s.push(Resistor.numericColorMap[mul as keyof typeof Resistor.numericColorMap]);
    }
    return s;
  }

  bands(): string[] {
    const toleranceBand = this.toleranceBand();
    return this.resistanceBands().concat(toleranceBand ? [toleranceBand] : []);
  }

  invalid(): boolean {
    return this.bands().some(v => v === undefined);
  }

  niceBands(): string[] {
    return this.bands().map(v => (v in niceColours ? niceColours[v] : v));
  }
}

export { renderScientificSi, parseSi, niceColours };
