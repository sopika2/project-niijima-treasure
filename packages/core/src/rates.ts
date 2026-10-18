/**
 * Reading published exchange rates. Fetching happens in the app; these functions only turn
 * what OTP and the MNB return into rows, so they can be tested without a network.
 */

export type RateType =
	'card_buy' | 'card_sell' | 'account_buy' | 'account_sell' | 'middle' | 'official';
export type RateSource = 'otp' | 'mnb' | 'manual';

export interface RateQuote {
	/** The foreign currency, e.g. EUR. */
	readonly currency: string;
	/** What the rate is in, e.g. HUF. */
	readonly quoteCurrency: string;
	readonly rateType: RateType;
	/** Exact decimal text for ONE unit of the currency, e.g. "395.12". */
	readonly rate: string;
	/** ISO timestamp from which the quote applies. */
	readonly validFrom: string;
	readonly source: RateSource;
}

const DECIMAL = /^\d+(\.\d+)?$/;

/** Decimal text of a positive number, without floating-point noise ("368.4", not "368.39999"). */
export function decimalText(value: number, maxDecimals = 6): string | null {
	if (!Number.isFinite(value) || value <= 0) return null;
	return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

/** Divides an exact decimal text by a unit like 1 or 100, still exactly when the unit is a power of ten. */
export function perUnit(rate: string, unit: number): string | null {
	const clean = rate.trim().replace(',', '.');
	if (!DECIMAL.test(clean) || !Number.isInteger(unit) || unit < 1) return null;
	if (unit === 1) return clean;
	const zeros = Math.log10(unit);
	if (!Number.isInteger(zeros)) return decimalText(Number(clean) / unit, 8);
	const [whole = '0', fraction = ''] = clean.split('.');
	const digits = whole.padStart(zeros + 1, '0');
	const text = `${digits.slice(0, -zeros)}.${digits.slice(-zeros)}${fraction}`;
	return text.replace(/^0+(?=\d)/, '').replace(/\.?0+$/, '') || '0';
}

interface OtpEntry {
	currencyCode?: unknown;
	unitSize?: unknown;
	middleRate?: unknown;
	foreignExchangeBuyingRate?: unknown;
	foreignExchangeSellingRate?: unknown;
	validityDate?: unknown;
}

/**
 * OTP's rate chart (https://www.otpbank.hu/apps/exchangerate/api/exchangerate/chart/EUR/{from}/{to}):
 * an array of quotes through the day, each valid until the next. Gives the middle rate and the
 * account (deviza) buy and sell rates, per one unit of the currency in HUF.
 */
export function parseOtpRates(json: unknown): RateQuote[] {
	if (!Array.isArray(json)) return [];
	const quotes: RateQuote[] = [];
	for (const raw of json as OtpEntry[]) {
		if (!raw || typeof raw !== 'object') continue;
		const currency = typeof raw.currencyCode === 'string' ? raw.currencyCode.toUpperCase() : null;
		const when = typeof raw.validityDate === 'string' ? new Date(raw.validityDate) : null;
		const unit = typeof raw.unitSize === 'number' ? raw.unitSize : 1;
		if (!currency || !/^[A-Z]{3}$/.test(currency) || !when || Number.isNaN(when.getTime()))
			continue;
		const validFrom = when.toISOString();
		const add = (value: unknown, rateType: RateType) => {
			const text = typeof value === 'number' ? decimalText(value) : null;
			const rate = text ? perUnit(text, unit) : null;
			if (rate)
				quotes.push({ currency, quoteCurrency: 'HUF', rateType, rate, validFrom, source: 'otp' });
		};
		add(raw.middleRate, 'middle');
		add(raw.foreignExchangeBuyingRate, 'account_buy');
		add(raw.foreignExchangeSellingRate, 'account_sell');
	}
	return quotes;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** The MNB's SOAP service returns its rate table as XML text inside the SOAP XML. */
function unescapeXml(text: string): string {
	return text.replace(/&(lt|gt|amp|quot|apos);/g, (_, name: string) => ENTITIES[name] ?? '');
}

/**
 * The MNB's official daily rates (GetCurrentExchangeRates): HUF per `unit` of each currency,
 * with a decimal comma, e.g. <Day date="2026-10-16"><Rate unit="1" curr="EUR">395,12</Rate>.
 * MNB rates apply from noon of their day (they are published around 11:00).
 */
export function parseMnbRates(responseText: string): RateQuote[] {
	const xml = responseText.includes('&lt;') ? unescapeXml(responseText) : responseText;
	const quotes: RateQuote[] = [];
	for (const day of xml.matchAll(/<Day\s+date="(\d{4}-\d{2}-\d{2})"\s*>([\s\S]*?)<\/Day>/g)) {
		const [, date, body] = day;
		if (!date || !body) continue;
		for (const rate of body.matchAll(/<Rate\s+([^>]*)>([^<]+)<\/Rate>/g)) {
			const [, attributes = '', value = ''] = rate;
			const unit = Number(/unit="(\d+)"/.exec(attributes)?.[1] ?? '1');
			const currency = /curr="([A-Z]{3})"/.exec(attributes)?.[1];
			const perOne = perUnit(value.trim(), unit);
			if (!currency || !perOne) continue;
			quotes.push({
				currency,
				quoteCurrency: 'HUF',
				rateType: 'official',
				rate: perOne,
				validFrom: `${date}T10:00:00.000Z`,
				source: 'mnb'
			});
		}
	}
	return quotes;
}

/** The SOAP request for the MNB's latest daily rates. */
export const MNB_REQUEST = {
	url: 'https://www.mnb.hu/arfolyamok.asmx',
	headers: {
		'content-type': 'text/xml; charset=utf-8',
		soapaction: '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetCurrentExchangeRates"'
	},
	body:
		'<?xml version="1.0" encoding="utf-8"?>' +
		'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.mnb.hu/webservices/">' +
		'<soap:Body><web:GetCurrentExchangeRates/></soap:Body></soap:Envelope>'
} as const;

/** OTP's rate chart URL for one currency and a date range (YYYY-MM-DD). */
export function otpRatesUrl(currency: string, from: string, to: string): string {
	return `https://www.otpbank.hu/apps/exchangerate/api/exchangerate/chart/${encodeURIComponent(currency)}/${from}/${to}`;
}
