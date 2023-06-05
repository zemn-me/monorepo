import '@pulumi/pulumi';
import 'ts/pulumi/setMocks';



describe('pulumi', () => {
	test('smoke', async () => {
		require('ts/pulumi');
		// eventually I think I need to make
		// the whole setup a custom component to make this
		// actually work.
		await new Promise(ok => setTimeout(ok, 5000));
	});
});
