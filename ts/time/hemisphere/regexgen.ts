/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';

import regexgen from 'regexgen';


const fc = readFile('py/time/hemisphere/tz_to_hemisphere.json')
	.then(ct => JSON.parse(ct.toString()));

const northernHemiLocs = new Set(
	Object.entries((await fc)).filter(
		([, v]) => v
	).map(([k]) => k));


const southernHemiLocs = new Set(
	Object.entries((await fc)).filter(
		([, v]) => !v
	).map(([k]) => k));

const southernHemiRe = regexgen([...southernHemiLocs]);
const northernHemiRe = regexgen([...northernHemiLocs]);

const southernHemiRes = southernHemiRe.toString();
const northernHemiRes = northernHemiRe.toString();

const body =
		northernHemiRes.length < southernHemiRes.length
		? `\
export const isNorthernHemisphereTz = (s: string) => ${northernHemiRes}.test(s);
export const isSouthernHemisphereTz = (s: string) => !isNorthernHemisphereTz(s);`
		: `\
export const isSouthernHemisphereTz = (s: string) => ${southernHemiRes}.test(s)
export const isNorthernHemisphereTz = (s: string) => !isSouthernHemisphereTz(s)`

console.log(body);
