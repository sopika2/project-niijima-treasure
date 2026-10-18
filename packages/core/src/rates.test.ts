import { describe, expect, it } from 'vitest';
import { decimalText, parseMnbRates, parseOtpRates, perUnit } from './rates.ts';

describe('rate text helpers', () => {
	it('writes floats without noise and divides by units exactly', () => {
		expect(decimalText(368.4)).toBe('368.4');
		expect(decimalText(0.1 + 0.2)).toBe('0.3');
		expect(perUnit('226,00', 100)).toBe('2.26');
		expect(perUnit('5', 100)).toBe('0.05');
		expect(perUnit('395.12', 1)).toBe('395.12');
		expect(perUnit('abc', 1)).toBeNull();
	});
});

describe('parseOtpRates', () => {
	// The shape OTP's chart endpoint returned on 2026-10-16 (one entry).
	const sample = [
		{
			currencyCode: 'EUR',
			hungarianName: 'Euro',
			englishName: 'Euro',
			unitSize: 1,
			middleRate: 363.86,
			currencyBuyingRate: 353.67,
			currencySellingRate: 374.04,
			chequeBuyingRate: 357.05,
			chequeSellingRate: 370.66,
			foreignExchangeBuyingRate: 359.31,
			foreignExchangeSellingRate: 368.4,
			validityDate: '2026-10-16T06:35:05.000+02:00',
			version: 1
		}
	];

	it('reads the middle and account rates', () => {
		expect(parseOtpRates(sample)).toEqual([
			{
				currency: 'EUR',
				quoteCurrency: 'HUF',
				rateType: 'middle',
				rate: '363.86',
				validFrom: '2026-10-16T04:35:05.000Z',
				source: 'otp'
			},
			{
				currency: 'EUR',
				quoteCurrency: 'HUF',
				rateType: 'account_buy',
				rate: '359.31',
				validFrom: '2026-10-16T04:35:05.000Z',
				source: 'otp'
			},
			{
				currency: 'EUR',
				quoteCurrency: 'HUF',
				rateType: 'account_sell',
				rate: '368.4',
				validFrom: '2026-10-16T04:35:05.000Z',
				source: 'otp'
			}
		]);
	});

	it('ignores anything that is not a quote', () => {
		expect(parseOtpRates({ error: 'x' })).toEqual([]);
		expect(
			parseOtpRates([
				null,
				{ currencyCode: 'EUR' },
				{ currencyCode: 'EUR', validityDate: 'nope', middleRate: 1 }
			])
		).toEqual([]);
	});
});

describe('parseMnbRates', () => {
	it('reads the rate table out of the SOAP reply, per one unit', () => {
		const inner =
			'<MNBCurrentExchangeRates><Day date="2026-10-16"><Rate unit="1" curr="EUR">395,12</Rate><Rate unit="100" curr="JPY">226,00</Rate></Day></MNBCurrentExchangeRates>';
		const soap = `<s:Envelope><s:Body><GetCurrentExchangeRatesResponse><GetCurrentExchangeRatesResult>${inner.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</GetCurrentExchangeRatesResult></GetCurrentExchangeRatesResponse></s:Body></s:Envelope>`;
		expect(
			parseMnbRates(soap).map((quote) => [
				quote.currency,
				quote.rate,
				quote.rateType,
				quote.validFrom
			])
		).toEqual([
			['EUR', '395.12', 'official', '2026-10-16T10:00:00.000Z'],
			['JPY', '2.26', 'official', '2026-10-16T10:00:00.000Z']
		]);
	});
});
