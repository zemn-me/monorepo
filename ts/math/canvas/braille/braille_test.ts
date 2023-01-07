import { plot } from 'monorepo/ts/math/canvas/braille/braille';


test('simple', () => {
	expect(plot([
		1, 1,
		1, 1,
		1, 1,
		1, 1
	], 2)).toEqual("⣿")
});

test('simple2', () => {
	expect(plot([
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
	], 6)).toEqual("⣿⠀⣿")
});


test('simple3', () => {
    expect(plot([
		1, 1, 1, 1, 1, 1,
		1, 0, 0, 0, 0, 1,
		1, 0, 0, 0, 0, 1,
		1, 1, 1, 1, 1, 1,
	], 6)).toEqual("⣏⣉⣹")
});

test('simple4', () => {
	expect(plot([
		1, 1,
		1, 1,
		1, 1,
		1, 1,
		1, 1,
		1, 1,
		1, 1,
		1, 1
	], 2)).toEqual("⣿\n⣿")
});

test('simple5', () => {
	expect(plot([
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,

		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
		1, 1, 0, 0, 1, 1,
	], 6)).toEqual("⣿⠀⣿\n⣿⠀⣿")
});




// slightly more than a braille character
test('complex1', () => {
    expect(plot([
		1, 1, 1, 1, 1, 1, 1,
		1, 0, 0, 0, 0, 1, 1, 
		1, 0, 0, 0, 0, 1, 1, 
		1, 1, 1, 1, 1, 1, 1,
	], 7)).toEqual("⣏⣉⣹⡇")
})

// slightly more than a braille character
// in both axes
test('complex1', () => {
    expect(plot([
		1, 1, 1, 1, 1, 1, 1,
		1, 0, 0, 0, 0, 1, 1, 
		1, 0, 0, 0, 0, 1, 1, 
		1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1
	], 7)).toEqual("⣏⣉⣹⡇")
})