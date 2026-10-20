import { describe, expect, it } from 'vitest';
import { ordinal } from './format.ts';

describe('ordinal', () => {
	it('writes English ordinals', () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map((day) => ordinal(day, 'en-HU'))).toEqual([
			'1st',
			'2nd',
			'3rd',
			'4th',
			'11th',
			'12th',
			'13th',
			'21st',
			'22nd',
			'23rd',
			'31st'
		]);
	});

	it('uses a full stop in languages that write ordinals that way', () => {
		expect(ordinal(5, 'hu-HU')).toBe('5.');
	});
});
