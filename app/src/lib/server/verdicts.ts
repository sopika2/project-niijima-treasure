import { daysBetween, formatMoney, money } from '@treasure/core';
import { countPending, foreignCurrencies, getSetting, setSetting, type Scope } from '@treasure/db';
import { today } from './ledger.ts';
import { log, logError } from './log.ts';
import { budgetRows, goalRows } from './plans.ts';
import { projection } from './projection.ts';
import type { Runtime } from './runtime.ts';

export interface Verdict {
	/** Stable per situation and period, so the same verdict isn't sent to Discord twice. */
	readonly key: string;
	readonly tone: 'danger' | 'warning' | 'info';
	readonly title: string;
	readonly href: string;
}

/** Fills {placeholders} in a sentence from style.yml. */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? String(values[name]) : match
	);
}

/**
 * Everything that needs your attention right now, most serious first. Without a scope it covers
 * everyone (the Discord alerts); with one, only that persona's money.
 */
export async function verdicts(app: Runtime, scope?: Scope): Promise<Verdict[]> {
	const words = app.style.current().style.copy.verdicts;
	const { locale, base_currency: base } = app.config;
	const { day, month } = today(app);
	const list: Verdict[] = [];
	const amount = (minor: number) => formatMoney(money(minor, base), { locale });
	const date = (iso: string) =>
		new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${iso}T00:00:00Z`)
		);
	const percent = (share: number) =>
		new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);

	const snapshot = app.snapshots.status();
	if (snapshot.state === 'off' || snapshot.state === 'blocked') {
		list.push({ key: `backup:${day}`, tone: 'danger', title: words.backup, href: '/system' });
	}

	for (const budget of budgetRows(app, month, scope)) {
		if (budget.state === 'over') {
			list.push({
				key: `budget-over:${budget.categoryId}:${month}`,
				tone: 'danger',
				title: fill(words.budget_over, { name: budget.name }),
				href: '/budgets'
			});
		} else if (budget.state === 'warn') {
			list.push({
				key: `budget-warn:${budget.categoryId}:${month}`,
				tone: 'warning',
				title: fill(words.budget_warn, { name: budget.name, percent: percent(budget.used) }),
				href: '/budgets'
			});
		} else if (budget.state === 'pace') {
			list.push({
				key: `budget-pace:${budget.categoryId}:${month}`,
				tone: 'info',
				title: fill(words.budget_pace, { name: budget.name }),
				href: '/budgets'
			});
		}
	}

	const floor = app.config.alerts.balance_floor * 100;
	const ahead = await projection(app, 60, [], scope);
	const dip = ahead.points.find((point) => point.balanceMinor < floor);
	if (dip) {
		list.push({
			key: `floor:${dip.date}`,
			tone: dip.balanceMinor < 0 ? 'danger' : 'warning',
			title: fill(words.balance_floor, { amount: amount(dip.balanceMinor), date: date(dip.date) }),
			href: '/'
		});
	}

	const pending = countPending(app.treasury.db, scope);
	if (pending > 0) {
		list.push({
			key: `pending:${day}:${pending}`,
			tone: 'info',
			title: pending === 1 ? words.pending_one : fill(words.pending, { count: pending }),
			href: '/recurring'
		});
	}

	for (const goal of goalRows(app, { scope })) {
		if (goal.late) {
			list.push({
				key: `goal-late:${goal.id}:${month}`,
				tone: 'warning',
				title: fill(words.goal_late, { name: goal.name }),
				href: '/treasures'
			});
		}
	}

	if (foreignCurrencies(app.treasury.db, base).length > 0) {
		const rates = app.rates.status();
		const newest = app.ratesAsOf();
		const age = newest ? daysBetween(newest.slice(0, 10), day) : null;
		if (rates.problem && (age === null || age > 1)) {
			list.push({
				key: `rates-failed:${day}`,
				tone: 'warning',
				title: words.rates_failed,
				href: '/system'
			});
		} else if (age !== null && age > 4) {
			list.push({
				key: `rates-stale:${day}`,
				tone: 'info',
				title: fill(words.rates_stale, { days: age }),
				href: '/system'
			});
		}
	}

	const rank = { danger: 0, warning: 1, info: 2 } as const;
	return list.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

function inQuietHours(span: string | undefined, timezone: string, now = new Date()): boolean {
	if (!span) return false;
	const [start, end] = span.split('-');
	const time = new Intl.DateTimeFormat('en-GB', {
		timeZone: timezone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(now);
	if (!start || !end) return false;
	return start <= end ? time >= start && time < end : time >= start || time < end;
}

const SENT = 'verdicts_sent';

/**
 * Sends verdicts not sent before to the Discord webhook (DISCORD_WEBHOOK_URL), outside quiet
 * hours. Remembers what was sent for 40 days so nothing repeats.
 */
export async function notifyDiscord(app: Runtime, webhook: string | null): Promise<number> {
	if (!webhook || !app.config.alerts.discord) return 0;
	if (inQuietHours(app.config.alerts.quiet_hours, app.config.timezone)) return 0;
	const { db } = app.treasury;
	const sent = getSetting<Record<string, string>>(db, SENT) ?? {};
	const fresh = (await verdicts(app)).filter(
		(verdict) => verdict.tone !== 'info' && !(verdict.key in sent)
	);
	if (fresh.length === 0) return 0;

	const copy = app.style.current().style.copy;
	const marks = { danger: '🟥', warning: '🟨', info: '⬜' } as const;
	const content = [
		`**${copy.app_name} · ${copy.verdicts.title}**`,
		...fresh.map((verdict) => `${marks[verdict.tone]} ${verdict.title}`)
	].join('\n');
	try {
		const response = await fetch(webhook, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) throw new Error(`Discord answered ${response.status}.`);
	} catch (error) {
		logError('verdicts', error);
		return 0;
	}
	const day = today(app).day;
	const kept = Object.fromEntries(
		Object.entries(sent).filter(([, when]) => daysBetween(when, day) < 40)
	);
	for (const verdict of fresh) kept[verdict.key] = day;
	setSetting(db, SENT, kept);
	log('verdicts', `sent ${fresh.length} to Discord`);
	return fresh.length;
}
