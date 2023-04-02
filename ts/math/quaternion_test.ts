import { Quaternion } from './quaternion'; // Adjust the import path accordingly

describe('Quaternion arithmetic', () => {
	test('addition', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.add(q2);
		expect(result.x).toBeCloseTo(5);
		expect(result.y).toBeCloseTo(5);
		expect(result.z).toBeCloseTo(5);
		expect(result.w).toBeCloseTo(5);
	});

	test('subtraction', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.subtract(q2);
		expect(result.x).toBeCloseTo(-3);
		expect(result.y).toBeCloseTo(-1);
		expect(result.z).toBeCloseTo(1);
		expect(result.w).toBeCloseTo(3);
	});

	test('multiplication', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.multiply(q2);
		expect(result.x).toBeCloseTo(-12);
		expect(result.y).toBeCloseTo(6);
		expect(result.z).toBeCloseTo(24);
		expect(result.w).toBeCloseTo(-12);
	});

	test('normalize', () => {
		const q = new Quaternion(1, 2, 3, 4);
		const normalizedQ = q.normalize();

		const length = normalizedQ.length();
		expect(length).toBeCloseTo(1);

		const expectedNormalizedQ = new Quaternion(
			0.18257,
			0.36515,
			0.54772,
			0.7303
		);
		expect(normalizedQ.x).toBeCloseTo(expectedNormalizedQ.x, 4);
		expect(normalizedQ.y).toBeCloseTo(expectedNormalizedQ.y, 4);
		expect(normalizedQ.z).toBeCloseTo(expectedNormalizedQ.z, 4);
		expect(normalizedQ.w).toBeCloseTo(expectedNormalizedQ.w, 4);
	});
});
