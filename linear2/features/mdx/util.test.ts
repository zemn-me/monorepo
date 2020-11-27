import { extractText } from './util';

test('extractText', () => {
    it('should extract single child string props', () => {
        expect(extractText({ props: { children: 'some text'}} as any)).toEqual('some text');
    });
});