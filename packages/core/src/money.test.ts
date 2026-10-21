import { describe, expect, it } from 'vitest';
import { add, formatMoney, money, parseMoney, subtract, sum, toDecimalString } from './money.ts';

describe('money', () => {
	it('only accepts whole minor units', () => {
		expect(() => money(1.5, 'HUF')).toThrow(/whole number/);
		expect(() => money(100, 'XYZ')).toThrow(/Unknown currency/);
	});

	it('adds and refuses to mix currencies', () => {
		expect(add(money(150, 'EUR'), money(250, 'EUR'))).toEqual(money(400, 'EUR'));
		expect(subtract(money(100, 'HUF'), money(250, 'HUF')).amount).toBe(-150);
		expect(() => add(money(1, 'EUR'), money(1, 'HUF'))).toThrow(/without a rate/);
		expect(sum([money(10, 'HUF'), money(20, 'HUF')], 'HUF').amount).toBe(30);
	});

	it('writes exact decimal text', () => {
		expect(toDecimalString(money(123456, 'HUF'))).toBe('1234.56');
		expect(toDecimalString(money(-5, 'EUR'))).toBe('-0.05');
		expect(toDecimalString(money(1500, 'JPY'))).toBe('1500');
	});
});

describe('parseMoney', () => {
	const cases: Array<[string, string, number]> = [
		['4 500', 'HUF', 450000],
		['4 500 Ft', 'HUF', 450000],
		['1 234,56', 'HUF', 123456],
		['1.234,56', 'EUR', 123456],
		['1,234.56', 'USD', 123456],
		['1234.5', 'EUR', 123450],
		['1,5', 'EUR', 150],
		['1,500', 'HUF', 150000],
		['1.500.000', 'HUF', 150000000],
		['-15', 'EUR', -1500],
		['0,99 €', 'EUR', 99]
	];

	it.each(cases)('reads "%s" %s', (input, code, minor) => {
		expect(parseMoney(input, code).amount).toBe(minor);
	});

	it('rejects nonsense and too many decimals', () => {
		expect(() => parseMoney('abc', 'HUF')).toThrow(/not an amount/);
		expect(() => parseMoney('1.2.3,4,5', 'HUF')).toThrow();
		expect(() => parseMoney('1,2345', 'EUR')).toThrow(/decimal places/);
	});
});

describe('formatMoney', () => {
	const plain = (text: string) => text.replace(/\s/g, ' ');

	it('shows forints without decimals and euros with two', () => {
		expect(plain(formatMoney(money(41250000, 'HUF'), { locale: 'hu-HU' }))).toBe('412 500 Ft');
		expect(plain(formatMoney(money(123456789, 'EUR'), { locale: 'hu-HU' }))).toBe('1 234 567,89 €');
	});

	it('writes forints after the amount in English too', () => {
		expect(plain(formatMoney(money(1248000, 'HUF'), { locale: 'en-GB' }))).toBe('12,480 Ft');
		expect(plain(formatMoney(money(-1248000, 'HUF'), { locale: 'en-GB' }))).toBe('-12,480 Ft');
		expect(plain(formatMoney(money(1248000, 'HUF'), { locale: 'en-GB', signed: true }))).toBe(
			'+12,480 Ft'
		);
		expect(plain(formatMoney(money(-2999, 'EUR'), { locale: 'en-GB' }))).toBe('-€29.99');
		expect(plain(formatMoney(money(1248000, 'HUF'), { locale: 'hu-HU' }))).toBe('12 480 Ft');
	});

	it('can force a sign for income', () => {
		const text = formatMoney(money(450000, 'EUR'), { locale: 'en-GB', signed: true });
		expect(plain(text)).toBe('+€4,500.00');
	});
});
