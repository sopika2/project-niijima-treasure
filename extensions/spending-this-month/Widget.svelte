<script lang="ts">
	import type { WidgetProps } from '@treasure/stats-sdk';
	import { Card, Money, useUi } from '@treasure/ui';
	import type { SpendingSettings, SpendingWidgetData } from './query.ts';

	let { data }: WidgetProps<SpendingWidgetData, SpendingSettings> = $props();
	const ui = useUi();

	const percent = $derived(
		new Intl.NumberFormat(ui.locale, { style: 'percent', maximumFractionDigits: 0 })
	);
	const label = (name: string | null, color: number | null) =>
		name ?? (color === null ? ui.copy.dashboard.other : ui.copy.transactions.uncategorized);
</script>

<Card title={ui.copy.dashboard.spending}>
	{#snippet actions()}
		<Money amount={data.total.amount} currency={data.total.currency} />
	{/snippet}

	{#if data.rows.length === 0}
		<p class="empty">{ui.copy.dashboard.no_spending}</p>
	{:else}
		<ol class="bars">
			{#each data.rows as row, index (index)}
				<li title={percent.format(row.share)}>
					<span class="name">{label(row.name, row.color)}</span>
					<span class="value"
						><Money amount={row.amount.amount} currency={row.amount.currency} size="sm" /></span
					>
					<span class="track">
						<span
							class="bar"
							style="--bar: {row.color === null
								? 'var(--tr-color-text-muted)'
								: `var(--tr-chart-${row.color})`}; --size: {data.max > 0
								? row.amount.amount / data.max
								: 0}"
						></span>
					</span>
				</li>
			{/each}
		</ol>
	{/if}
	{#if data.missingRates > 0}
		<p class="note">
			{data.missingRates === 1
				? ui.copy.status.missing_entries_one
				: ui.copy.status.missing_entries.replace('{count}', String(data.missingRates))}
		</p>
	{/if}
</Card>

<style>
	.bars {
		display: grid;
		gap: var(--tr-space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px var(--tr-space-sm);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--tr-text-sm);
	}
	.value {
		color: var(--tr-color-text-muted);
	}
	.track {
		grid-column: 1 / -1;
		height: 0.5rem;
	}
	.bar {
		display: block;
		width: calc(var(--size) * 100%);
		min-width: 4px;
		height: 100%;
		border-radius: 0 4px 4px 0;
		background: var(--bar);
		transform-origin: left;
		animation: grow var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}
	.empty,
	.note {
		margin: 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
</style>
