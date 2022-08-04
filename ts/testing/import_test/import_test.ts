import * as a from 'monorepo/ts/testing/import_test/a';

test('import', () => {
	expect(a.MyString).toEqual('Hello world!');
});
