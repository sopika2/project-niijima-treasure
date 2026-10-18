<script lang="ts">
	import { BarChart, Card, Icon, LineChart, Money, PageHeader, Stat, useUi } from '@treasure/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.reports);

	const monthLabel = (month: string) =>
		new Intl.DateTimeFormat(ui.locale, { month: 'short', timeZone: 'UTC' }).format(
			new Date(`${month}-01T00:00:00Z`)
		);
	const groups = $derived(
		data.months.map((row) => ({
			label: monthLabel(row.month),
			values: [row.incomeMinor, row.expenseMinor]
		}))
	);
	const series = $derived([
		{ label: ui.copy.terms.income, tone: 'income' as const },
		{ label: ui.copy.terms.expense, tone: 'expense' as const }
	]);
	const percent = (share: number) =>
		new Intl.NumberFormat(ui.locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);
	const empty = $derived(data.totals.income === 0 && data.totals.spent === 0);
	const exportHref = (format: 'csv' | 'json') =>
		`/reports/export?from=${data.from}&to=${data.to}&format=${format}`;
</script>

<PageHeader title={words.title} subtitle={words.subtitle}>
	{#snippet actions()}
		<nav class="span" aria-label={words.title}>
			<a href="?months=6" aria-current={data.span === 6 ? 'page' : undefined}>{words.months_6}</a>
			<a href="?months=12" aria-current={data.span === 12 ? 'page' : undefined}>{words.months_12}</a
			>
		</nav>
	{/snippet}
</PageHeader>

<dl class="stats">
	<Stat label="{ui.copy.terms.income} · {words.average_month}">
		<Money amount={data.totals.averageIncome} currency={ui.baseCurrency} size="lg" />
	</Stat>
	<Stat label="{ui.copy.terms.expense} · {words.average_month}">
		<Money amount={data.totals.averageSpent} currency={ui.baseCurrency} size="lg" />
	</Stat>
	<Stat label={ui.copy.dashboard.net}>
		<Money
			amount={data.totals.income - data.totals.spent}
			currency={ui.baseCurrency}
			signed
			tone="auto"
			size="lg"
		/>
	</Stat>
</dl>

<div class="grid">
	<Card title={words.income_vs_spending} wide>
		{#if empty}
			<p class="muted">{words.no_data}</p>
		{:else}
			<BarChart label={words.income_vs_spending} {series} {groups} currency={ui.baseCurrency} />
		{/if}
	</Card>

	<Card title={words.net_worth} wide>
		<LineChart
			label={words.net_worth}
			points={data.netWorth}
			currency={ui.baseCurrency}
			height={220}
		/>
	</Card>

	<Card title={words.categories}>
		{#if data.byCategory.length === 0}
			<p class="muted">{words.no_data}</p>
		{:else}
			<ol class="categories">
				{#each data.byCategory as row (row.id)}
					<li
						style="--chip: {row.name === null
							? 'var(--tr-color-text-muted)'
							: `var(--tr-chart-${row.color})`}; --share: {row.share}"
					>
						<span class="cat-name">{row.name ?? ui.copy.transactions.uncategorized}</span>
						<span class="cat-amount"><Money amount={row.amount} currency={ui.baseCurrency} /></span>
						<span class="bar"><span></span></span>
						<span class="cat-share">{percent(row.share)}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</Card>

	<Card title={words.export}>
		<p class="muted">{data.from} – {data.to}</p>
		<div class="exports">
			<a class="export" href={exportHref('csv')} download
				><Icon name="download" />{words.export_csv}</a
			>
			<a class="export" href={exportHref('json')} download
				><Icon name="download" />{words.export_json}</a
			>
		</div>
		{#if data.totals.missingRates > 0}
			<p class="muted small">{ui.copy.status.missing_rates} {data.totals.missingRates}</p>
		{/if}
	</Card>
</div>

<style>
	.span {
		display: flex;
		gap: var(--tr-space-xs);
	}
	.span a {
		padding: var(--tr-space-xs) var(--tr-space-md);
		background: var(--tr-color-surface);
		color: var(--tr-color-text);
		font-family: var(--tr-font-heading);
		text-decoration: none;
		transform: skewX(var(--tr-skew));
	}
	.span a[aria-current='page'] {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		box-shadow: 4px 4px 0 var(--tr-color-accent);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--tr-space-lg);
		margin: 0 0 var(--tr-space-xl);
		padding: var(--tr-space-md) 0;
		border-block: var(--tr-border-width) solid var(--tr-color-border);
	}
	.grid {
		display: grid;
		gap: var(--tr-space-lg);
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.grid > :global(.wide) {
			grid-column: 1 / -1;
		}
	}
	.muted {
		margin: 0;
		color: var(--tr-color-text-muted);
	}
	.small {
		margin-block-start: var(--tr-space-md);
		font-size: var(--tr-text-sm);
	}
	.categories {
		display: grid;
		gap: var(--tr-space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.categories li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 4px var(--tr-space-md);
		align-items: center;
	}
	.cat-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		height: 0.55rem;
		background: var(--tr-color-surface-raised);
		transform: skewX(var(--tr-skew));
	}
	.bar span {
		display: block;
		width: calc(var(--share) * 100%);
		height: 100%;
		background: var(--chip);
	}
	.cat-share {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		font-variant-numeric: var(--tr-numeric);
		text-align: end;
	}
	.exports {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tr-space-sm);
		margin-block-start: var(--tr-space-md);
	}
	.export {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-sm);
		padding: var(--tr-space-sm) var(--tr-space-md);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-family: var(--tr-font-heading);
		text-decoration: none;
		transform: skewX(var(--tr-skew));
		box-shadow: 4px 4px 0 var(--tr-color-accent);
	}
	.export:hover {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
		box-shadow: 4px 4px 0 var(--tr-color-paper);
	}
</style>
