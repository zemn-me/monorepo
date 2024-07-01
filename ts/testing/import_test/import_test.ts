import * as a from '#root/ts/testing/import_test/a';

test('import', () => {
	expect(a.MyString).toEqual('Hello world!');
});
