import * as cultist from '//cultist';



describe('decreaseQuantity', () => {
	test('stacked', () => {
		let elements = Object.entries({ 'someident123': cultist.state.createElement('money', {
			quantity: 10
		})});

		const [[,el]] = cultist.action.decreaseQuantityBy('money', elements, 5);


		expect(el.quantity).toEqual(5);

	});

	test('unstacked', () => {
		const elements = Object.entries({
			'abc': cultist.state.createElement('money'),
			'def': cultist.state.createElement('money'),
			'hij': cultist.state.createElement('money')
		});

		const [...els] = cultist.action.decreaseQuantityBy('money', elements, 2);

		expect(els.length).toEqual(1);
	});
});
