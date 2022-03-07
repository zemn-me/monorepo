import Immutable from 'immutable';
import { sort, Sorted } from 'ts/sort/memo';

test('simple', () => {
	expect(
		(sort(
			Immutable.Set<Sorted<string>>([
				new Sorted(['cake', /* > */ 'tomatoes']),
				new Sorted(['tomatoes', /* > */ 'dirt']),
				new Sorted(['bibimbap', /* > */ 'cake']),
			]),
			(a: string, b: string) => a === b
		) as Sorted<string>).value
	).toEqual(["bibimbap", "cake", "tomatoes", "dirt"]);
        });

    test('complex', () => {
        const res = sort(
			Immutable.Set<Sorted<string>>([
				new Sorted(['cake', /* > */ 'tomatoes']),
                new Sorted(['cake', /* > */ 'egg' ]),
                new Sorted(['egg', /* > */ 'tomatoes' ]),
				new Sorted(['tomatoes', /* > */ 'dirt']),
				new Sorted(['bibimbap', /* > */ 'cake']),
			]),
			(a: string, b: string) => a === b
		) as Sorted<string>;

        if (res instanceof Error) throw res;

	expect(res.value).toEqual(["bibimbap", "cake", "tomatoes", "dirt"]);
        });
test('error', () => {
	expect(() => {
        const v = sort(
			Immutable.Set<Sorted<string>>([
				new Sorted(['cake', /* > */ 'tomatoes']),
				new Sorted(['tomatoes', /* > */ 'dirt']),
				new Sorted(['bibimbap', /* > */ 'cake']),
				new Sorted(['egg', /* > */ 'mayonnaise']),
			]),
			(a: string, b: string) => a === b
		);

        console.log(v);
        if (v instanceof Error) throw v;
    }).toThrowError("ok");

});
