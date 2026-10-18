import { describe, expect, it } from 'vitest';
import { convert, impliedRate } from './convert.ts';
import { money } from './money.ts';

describe('convert', () => {
	it('converts euros to forints with an exact rate', () => {
		const result = convert(money(1000, 'EUR'), { from: 'EUR', to: 'HUF', rate: '395.12' });
		expect(result).toEqual(money(395120, 'HUF'));
	});

	it('rounds half away from zero once, at the end', () => {
		// 0.01 EUR × 395.125 = 3.95125 HUF → 3.95 HUF
		expect(convert(money(1, 'EUR'), { from: 'EUR', to: 'HUF', rate: '395.125' }).amount).toBe(395);
		// 0.03 EUR × 0.5 = 0.015 → 0.02 (half rounds away from zero)
		expect(convert(money(3, 'EUR'), { from: 'EUR', to: 'USD', rate: '0.5' }).amount).toBe(2);
		expect(convert(money(-3, 'EUR'), { from: 'EUR', to: 'USD', rate: '0.5' }).amount).toBe(-2);
	});

	it('handles currencies with different minor units', () => {
		expect(convert(money(1000, 'JPY'), { from: 'JPY', to: 'HUF', rate: '2.5' }).amount).toBe(
			250000
		);
	});

	it('refuses a rate for the wrong currency', () => {
		expect(() => convert(money(100, 'USD'), { from: 'EUR', to: 'HUF', rate: '1' })).toThrow();
	});
});

describe('impliedRate', () => {
	it('works out the real rate of a transfer from both legs', () => {
		const rate = impliedRate(money(10000, 'EUR'), money(3951200, 'HUF'));
		expect(rate).toEqual({ from: 'EUR', to: 'HUF', rate: '395.12' });
	});
});
