import * as semver from './semver';

test('increment', () => {
    const n = semver.add([1, 10, 10], [1, 0, 0]);

    expect(semver.major(n)).toEqual(2);
    expect(semver.minor(n)).toEqual(0);
    expect(semver.patch(n)).toEqual(0);
});


test('decrement', () => {
    const n = semver.add([1, 10, 10], [-1, 0, 0]);

    expect(semver.major(n)).toEqual(0);
    expect(semver.minor(n)).toEqual(0);
    expect(semver.patch(n)).toEqual(0);
});


test('decrement with minor', () => {
    const n = semver.add([1, 10, 10], [-1, 5, 6]);

    expect(semver.major(n)).toEqual(0);
    expect(semver.minor(n)).toEqual(5);
    expect(semver.patch(n)).toEqual(6);
});

test('toString', () => {
    expect(semver.toString(1, 0, 0)).toEqual("1.0.0");
    expect(semver.toString(1, 10, 5)).toEqual("1.10.5");
    expect(semver.toString(1, 10, 0, "eggs")).toEqual("1.10.0-eggs");
    expect(semver.toString(1, 4, 2, "eggs", "bacon")).toEqual("1.10.0-eggs+bacon");
    expect(semver.toString(1, 4, 2, undefined, "chicken")).toEqual("1.4.2+chicken");
})