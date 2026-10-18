<script lang="ts">
	import { widgets } from '#lib';
	import {
		Button,
		Card,
		DateTag,
		EmptyState,
		Icon,
		LineChart,
		Money,
		Notice,
		Stat,
		useUi
	} from '@treasure/ui';
	import { fill } from '#lib/forms.ts';
	import TransactionList from '#lib/components/TransactionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const copy = $derived(ui.copy);
	const net = $derived(data.month.incomeMinor - data.month.expenseMinor);
	const words = $derived(copy.projection);

	/* ── Forecast ─────────────────────────────────────────────────────────── */
	let range = $state<30 | 90 | 0>(90);
	const shown = $derived(
		range === 0 ? data.forecast.points : data.forecast.points.slice(0, range + 1)
	);
	let whatIfAmount = $state('');
	let whatIfDate = $state('');
	let whatIf = $state<{ amount: number; date: string } | null>(null);
	const compare = $derived(
		whatIf
			? shown.map((point) => ({
					date: point.date,
					value: point.date >= whatIf!.date ? point.value - whatIf!.amount : point.value
				}))
			: []
	);
	function applyWhatIf(event: SubmitEvent) {
		event.preventDefault();
		const amount = Number(whatIfAmount.replace(/\s/g, '').replace(',', '.'));
		if (!Number.isFinite(amount) || amount === 0) return;
		whatIf = {
			amount: Math.round(amount * 100),
			date: whatIfDate || data.forecast.points[0]!.date
		};
	}
	const markers = $derived(
		data.upcoming.map((event) => ({ date: event.date, label: event.label }))
	);
	const shownLowest = $derived(
		shown.reduce(
			(low, point) => (point.value < low.value ? point : low),
			shown[0] ?? data.forecast.lowest
		)
	);
	const dateText = (iso: string) =>
		new Intl.DateTimeFormat(ui.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${iso}T00:00:00Z`)
		);
	const ranges = $derived([
		{ value: 30 as const, label: words.range_1m },
		{ value: 90 as const, label: words.range_3m },
		{ value: 0 as const, label: words.range_all }
	]);
</script>

<section class="hero" aria-label={copy.terms.total}>
	<div class="slab" aria-hidden="true"></div>
	<p class="kicker"><span>{copy.terms.total}</span></p>
	<p class="total">
		<Money amount={data.balances.total.amount} currency={data.balances.total.currency} size="xl" />
	</p>
	{#if data.balances.missingRates.length > 0}
		<p class="missing">{copy.status.missing_rates} {data.balances.missingRates.join(', ')}</p>
	{/if}

	<dl class="month">
		<div class="month-title">{copy.dashboard.this_month}</div>
		<div>
			<dt>{copy.terms.income}</dt>
			<dd><Money amount={data.month.incomeMinor} currency={ui.baseCurrency} tone="auto" /></dd>
		</div>
		<div>
			<dt>{copy.terms.expense}</dt>
			<dd><Money amount={-data.month.expenseMinor} currency={ui.baseCurrency} tone="auto" /></dd>
		</div>
		<div>
			<dt>{copy.dashboard.net}</dt>
			<dd><Money amount={net} currency={ui.baseCurrency} signed /></dd>
		</div>
	</dl>

	{#if data.balances.accounts.length > 0}
		<ul class="accounts">
			{#each data.balances.accounts as account (account.id)}
				<li>
					<a href="/transactions?account={account.id}">
						<span class="account-name">{account.name}</span>
						<Money amount={account.balance.amount} currency={account.balance.currency} size="sm" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.balances.accounts.length === 0}
	<EmptyState message={copy.dashboard.no_accounts}>
		<Button href="/accounts?new=1"><Icon name="plus" />{copy.dashboard.add_account}</Button>
	</EmptyState>
{/if}

<div class="grid">
	<Card title={copy.verdicts.title} accent>
		{#if data.verdicts.length === 0}
			<p class="clean"><Icon name="star" />{copy.verdicts.none}</p>
		{:else}
			<ul class="verdicts">
				{#each data.verdicts as verdict (verdict.key)}
					<li data-tone={verdict.tone}>
						<a href={verdict.href}><Icon name="gavel" size="1.1em" /><span>{verdict.title}</span></a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card title={copy.dashboard.coming_up}>
		{#snippet actions()}
			<a class="more" href="/recurring">{copy.dashboard.see_all} <Icon name="right" size="1em" /></a
			>
		{/snippet}
		{#if data.upcoming.length === 0}
			<p class="quiet">{copy.recurring.empty}</p>
		{:else}
			<ul class="upcoming">
				{#each data.upcoming as event, i (i)}
					<li>
						<DateTag date={event.date} tone={event.amountMinor < 0 ? 'paper' : 'accent'} />
						<span class="event-name">{event.label}</span>
						<Money amount={event.amountMinor} currency={ui.baseCurrency} signed tone="auto" />
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card title={words.title} wide>
		{#snippet actions()}
			<div class="ranges" role="group" aria-label={words.title}>
				{#each ranges as option (option.value)}
					<button
						type="button"
						aria-pressed={range === option.value}
						onclick={() => (range = option.value)}>{option.label}</button
					>
				{/each}
			</div>
		{/snippet}
		<dl class="forecast-stats">
			<Stat label={words.lowest} hint={dateText(shownLowest.date)}>
				<Money
					amount={shownLowest.value}
					currency={ui.baseCurrency}
					tone={shownLowest.value < 0 ? 'auto' : 'none'}
					size="lg"
				/>
			</Stat>
			{#if data.forecast.monthEnd}
				<Stat label={words.month_end} hint={dateText(data.forecast.monthEnd.date)}>
					<Money amount={data.forecast.monthEnd.value} currency={ui.baseCurrency} size="lg" />
				</Stat>
			{/if}
			<Stat label={words.horizon_end} hint={dateText(shown.at(-1)?.date ?? data.forecast.end.date)}>
				<Money
					amount={shown.at(-1)?.value ?? data.forecast.end.value}
					currency={ui.baseCurrency}
					size="lg"
				/>
			</Stat>
		</dl>
		<LineChart
			label={words.title}
			points={shown}
			currency={ui.baseCurrency}
			{compare}
			compareLabel={words.what_if}
			guide={data.forecast.floor > 0 ? data.forecast.floor : null}
			{markers}
		/>
		<p class="basis">
			{data.forecast.basis === 'average'
				? fill(words.basis_average, { months: data.forecast.months })
				: words.basis_fixed}:
			<Money amount={Math.round(data.forecast.dailySpend * 30.44)} currency={ui.baseCurrency} />
			{copy.recurring.per_month}
		</p>
		<form class="what-if" onsubmit={applyWhatIf}>
			<span class="what-if-title">{words.what_if}</span>
			<label>
				<span class="visually-hidden">{words.what_if_amount}</span>
				<input inputmode="decimal" placeholder={words.what_if_amount} bind:value={whatIfAmount} />
			</label>
			<label>
				<span class="visually-hidden">{words.what_if_date}</span>
				<input type="date" min={data.forecast.points[0]?.date} bind:value={whatIfDate} />
			</label>
			<Button type="submit" variant="secondary">{words.what_if_apply}</Button>
			{#if whatIf}
				<Button
					variant="ghost"
					onclick={() => {
						whatIf = null;
						whatIfAmount = '';
					}}>{words.what_if_clear}</Button
				>
			{/if}
		</form>
	</Card>

	<Card title={copy.dashboard.recent} wide>
		{#snippet actions()}
			<a class="more" href="/transactions"
				>{copy.dashboard.see_all} <Icon name="right" size="1em" /></a
			>
		{/snippet}
		{#if data.recent.length === 0}
			<p class="quiet">{copy.dashboard.no_activity}</p>
		{:else}
			<TransactionList rows={data.recent} grouped={false} />
		{/if}
	</Card>

	{#each data.widgets as widget (widget.id)}
		{@const Widget = widgets.get(widget.id)}
		{#if widget.error}
			<Card title={widget.name} wide={widget.wide}>
				<Notice tone="danger" title={widget.name}>{widget.error}</Notice>
			</Card>
		{:else if Widget}
			<Widget data={widget.data} settings={widget.settings} />
		{/if}
	{/each}
</div>

<style>
	/* The hero: a dark panel cut by a red slab, with the total front and center. */
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: grid;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-lg);
		padding: var(--tr-space-lg);
		background: var(--tr-color-surface);
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
	}
	.slab {
		position: absolute;
		z-index: -1;
		/* Phones: a corner cut that stays clear of the numbers. */
		inset: -10% -10% 66% 74%;
		background:
			radial-gradient(var(--tr-color-surface) 1px, transparent 1.4px) 0 0 / 9px 9px,
			var(--tr-color-accent);
		clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%, 10% 55%, 4% 50%);
		opacity: 0.9;
		animation: sweep var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}
	.kicker {
		justify-self: start;
		margin: 0;
		padding: 2px var(--tr-space-sm);
		background: var(--tr-color-text);
		color: var(--tr-color-background);
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-bold);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		transform: skewX(var(--tr-skew));
	}
	.kicker span {
		display: inline-block;
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	.total {
		margin: 0;
		font-family: var(--tr-font-heading);
		font-style: var(--tr-heading-style);
		text-shadow: 0.05em 0.05em 0 var(--tr-color-accent);
	}
	.total :global(.money) {
		font-family: inherit;
		font-size: clamp(2.25rem, 9vw, 3.75rem);
	}
	.missing {
		max-width: 30ch;
		margin: 0;
		color: var(--tr-color-warning);
		font-size: var(--tr-text-sm);
	}
	.month {
		display: grid;
		grid-template-columns: repeat(3, auto);
		justify-content: start;
		gap: var(--tr-space-xs) var(--tr-space-lg);
		margin-block-start: var(--tr-space-sm);
	}
	.month-title {
		grid-column: 1 / -1;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	dt {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
	dd {
		margin: 0;
		font-weight: var(--tr-weight-bold);
	}
	.accounts {
		display: flex;
		gap: var(--tr-space-sm);
		margin: var(--tr-space-md) calc(var(--tr-space-lg) * -1) calc(var(--tr-space-lg) * -1);
		padding: var(--tr-space-md) var(--tr-space-lg) var(--tr-space-lg);
		overflow-x: auto;
		list-style: none;
		border-top: var(--tr-border-width) solid var(--tr-color-border);
		background: var(--tr-color-surface);
	}
	.accounts a {
		display: grid;
		gap: 2px;
		min-width: 9rem;
		padding: var(--tr-space-sm) var(--tr-space-md);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-secondary);
		background: var(--tr-color-surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.account-name {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		white-space: nowrap;
	}

	.grid {
		display: grid;
		gap: var(--tr-space-lg);
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: repeat(var(--tr-columns), minmax(0, 1fr));
		}
		.hero {
			padding: var(--tr-space-xl);
		}
		.slab {
			inset: -20% -10% -20% 62%;
		}
		.accounts {
			margin: var(--tr-space-md) calc(var(--tr-space-xl) * -1) calc(var(--tr-space-xl) * -1);
			padding: var(--tr-space-md) var(--tr-space-xl) var(--tr-space-lg);
		}
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-xs);
		color: var(--tr-color-accent);
		font-size: var(--tr-text-sm);
		text-decoration: none;
	}
	.quiet {
		margin: 0;
		color: var(--tr-color-text-muted);
	}
	.clean {
		display: flex;
		align-items: center;
		gap: var(--tr-space-sm);
		margin: 0;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
	}
	.verdicts,
	.upcoming {
		display: grid;
		gap: var(--tr-space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.verdicts a {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: var(--tr-space-sm);
		padding: var(--tr-space-sm) var(--tr-space-md);
		border-inline-start: var(--tr-accent-border-width) solid var(--tone);
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text);
		text-decoration: none;
	}
	.verdicts a:hover {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.verdicts [data-tone='danger'] {
		--tone: var(--tr-color-danger);
	}
	.verdicts [data-tone='warning'] {
		--tone: var(--tr-color-warning);
	}
	.verdicts [data-tone='info'] {
		--tone: var(--tr-color-secondary);
	}
	.upcoming li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--tr-space-md);
	}
	.event-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ranges {
		display: flex;
		gap: 2px;
	}
	.ranges button {
		min-width: 2.75rem;
		min-height: 2rem;
		border: 0;
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text);
		font-family: var(--tr-font-heading);
		cursor: pointer;
		transform: skewX(var(--tr-skew));
	}
	.ranges button[aria-pressed='true'] {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.forecast-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--tr-space-md);
		margin: 0 0 var(--tr-space-md);
	}
	.basis {
		margin: var(--tr-space-sm) 0 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
	.what-if {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--tr-space-sm);
		align-items: center;
		margin-block-start: var(--tr-space-md);
		padding-block-start: var(--tr-space-md);
		border-top: var(--tr-border-width) solid var(--tr-color-border);
	}
	.what-if-title {
		grid-column: 1 / -1;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
	}
	@media (min-width: 720px) {
		.what-if {
			grid-template-columns: auto 12rem 11rem auto auto;
			justify-content: start;
		}
		.what-if-title {
			grid-column: auto;
		}
	}
	@keyframes sweep {
		from {
			transform: translateX(25%);
		}
	}
</style>
