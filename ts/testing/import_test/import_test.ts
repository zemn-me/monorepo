import * as a from 'ts/testing/import_test/a';

test('import', () => {
	expect(a.MyString).toEqual('fuck');
});
