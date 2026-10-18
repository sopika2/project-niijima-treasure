<script lang="ts">
	import { widgets } from '#lib';
	import { Button, Card, EmptyState, Icon, Money, Notice, useUi } from '@treasure/ui';
	import TransactionList from '#lib/components/TransactionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const copy = $derived(ui.copy);
	const net = $derived(data.month.incomeMinor - data.month.expenseMinor);
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
	@keyframes sweep {
		from {
			transform: translateX(25%);
		}
	}
</style>
