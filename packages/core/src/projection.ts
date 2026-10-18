import { addDays, daysBetween } from './recurrence.ts';

export interface ProjectionEvent {
	readonly date: string;
	/** Signed, base currency, minor units: income positive, bills negative. */
	readonly amountMinor: number;
	readonly label: string;
}

export interface ProjectionPoint {
	readonly date: string;
	/** Balance at the end of the day. */
	readonly balanceMinor: number;
	readonly events: readonly ProjectionEvent[];
}

export interface Projection {
	readonly points: readonly ProjectionPoint[];
	readonly lowest: ProjectionPoint;
	readonly end: ProjectionPoint;
}

export interface ProjectionInput {
	/** YYYY-MM-DD; the first point is today's balance after anything still due today. */
	readonly today: string;
	readonly until: string;
	/** Today's balance, base currency, minor units. */
	readonly startMinor: number;
	/** Known future income and bills. Ones dated today or earlier land on today. */
	readonly events: readonly ProjectionEvent[];
	/** Estimated everyday spending per day not covered by events (positive, minor units). */
	readonly dailySpendMinor: number;
}

/**
 * Balance day by day: today's balance, plus every known event on its date, minus an everyday
 * spending estimate for each day after today. Whole minor units throughout; the daily estimate is
 * spread so the total over any period is exact to within one unit.
 */
export function projectBalance(input: ProjectionInput): Projection {
	const days = Math.max(0, daysBetween(input.today, input.until));
	const byDate = new Map<string, ProjectionEvent[]>();
	for (const event of input.events) {
		const date = event.date < input.today ? input.today : event.date;
		if (date > input.until) continue;
		const list = byDate.get(date) ?? [];
		list.push(event);
		byDate.set(date, list);
	}

	const points: ProjectionPoint[] = [];
	let balance = input.startMinor;
	let spent = 0;
	for (let day = 0; day <= days; day += 1) {
		const date = addDays(input.today, day);
		const events = byDate.get(date) ?? [];
		for (const event of events) balance += event.amountMinor;
		if (day > 0) {
			const target = Math.round(input.dailySpendMinor * day);
			balance -= target - spent;
			spent = target;
		}
		points.push({ date, balanceMinor: balance, events });
	}
	const first = points[0]!;
	const lowest = points.reduce(
		(low, point) => (point.balanceMinor < low.balanceMinor ? point : low),
		first
	);
	return { points, lowest, end: points.at(-1) ?? first };
}

/** The balance on one date from a projection, or null if the date is outside it. */
export function balanceOn(projection: Projection, date: string): number | null {
	return projection.points.find((point) => point.date === date)?.balanceMinor ?? null;
}
