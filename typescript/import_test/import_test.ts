import * as a from '//typescript/import_test/a';

test('import', () => {
	expect(a.MyString).toEqual('Hello world!');
});
