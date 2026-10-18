<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Card, EmptyState, Icon, Money, Notice, PageHeader, useUi } from '@treasure/ui';
	import TransactionList from '#lib/components/TransactionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.transactions);

	const monthName = $derived(
		new Intl.DateTimeFormat(ui.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${data.month}-01T00:00:00Z`)
		)
	);

	/** A query string from key/value pairs, skipping empty ones. Built fresh each time, never state. */
	function query(entries: Iterable<[string, FormDataEntryValue]>): string {
		const parts: string[] = [];
		for (const [key, value] of entries) {
			if (typeof value === 'string' && value) {
				parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
			}
		}
		return `?${parts.join('&')}`;
	}

	function link(month: string) {
		const kept = [...page.url.searchParams].filter(
			([key]) => !['month', 'saved', 'deleted'].includes(key)
		);
		return query([['month', month], ...kept]);
	}

	// Follows the URL, but you can type in it freely until the next navigation.
	let search = $derived(data.filters.q);

	function apply(form: HTMLFormElement) {
		goto(query([['month', data.month], ...new FormData(form)]), { replace: true, reset: false });
	}

	const net = $derived(data.totals.incomeMinor - data.totals.expenseMinor);
</script>

<PageHeader title={words.title} />

<nav class="months" aria-label={monthName}>
	<a class="step" href={link(data.previous)} aria-label={words.previous_month}
		><Icon name="left" /></a
	>
	<h2 class="month">{monthName}</h2>
	{#if data.next}
		<a class="step" href={link(data.next)} aria-label={words.next_month}><Icon name="right" /></a>
	{:else}
		<span class="step disabled" aria-hidden="true"><Icon name="right" /></span>
	{/if}
</nav>
{#if !data.isCurrentMonth}
	<p class="back"><a href={link(page.data.today.slice(0, 7))}>{words.this_month}</a></p>
{/if}

<div class="totals">
	<div>
		<span>{ui.copy.terms.income}</span><Money
			amount={data.totals.incomeMinor}
			currency={ui.baseCurrency}
			tone="auto"
		/>
	</div>
	<div>
		<span>{ui.copy.terms.expense}</span><Money
			amount={-data.totals.expenseMinor}
			currency={ui.baseCurrency}
			tone="auto"
		/>
	</div>
	<div>
		<span>{ui.copy.dashboard.net}</span><Money amount={net} currency={ui.baseCurrency} signed />
	</div>
</div>

<form
	class="filters"
	onchange={(event) => apply(event.currentTarget)}
	onsubmit={(event) => {
		event.preventDefault();
		apply(event.currentTarget);
	}}
>
	<label class="search">
		<span class="visually-hidden">{words.search}</span>
		<Icon name="search" />
		<input type="search" name="q" placeholder={words.search} bind:value={search} />
	</label>
	<select name="account" value={data.filters.account} aria-label={words.all_accounts}>
		<option value="">{words.all_accounts}</option>
		{#each page.data.accounts as account (account.id)}
			<option value={account.id}>{account.name}</option>
		{/each}
	</select>
	<select name="category" value={data.filters.category} aria-label={words.all_categories}>
		<option value="">{words.all_categories}</option>
		{#each page.data.categories as category (category.id)}
			<option value={category.id}>{category.name}</option>
		{/each}
	</select>
	<select name="kind" value={data.filters.kind} aria-label={words.all_kinds}>
		<option value="">{words.all_kinds}</option>
		<option value="expense">{ui.copy.terms.expense}</option>
		<option value="income">{ui.copy.terms.income}</option>
		<option value="transfer">{ui.copy.terms.transfer}</option>
	</select>
</form>

{#if data.totals.missingRates > 0}
	<Notice tone="info" title={ui.copy.status.missing_rates}>{data.totals.missingRates}</Notice>
{/if}

{#if data.rows.length === 0}
	<EmptyState message={words.empty} />
{:else}
	<Card>
		<TransactionList rows={data.rows} />
	</Card>
{/if}

<style>
	.months {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--tr-space-sm);
	}
	.month {
		margin: 0;
		text-align: center;
		font-size: var(--tr-text-lg);
	}
	.step {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--tr-radius-md);
		background: var(--tr-color-surface);
		color: var(--tr-color-text);
	}
	.step.disabled {
		opacity: 0.3;
	}
	.back {
		margin: var(--tr-space-xs) 0 0;
		text-align: center;
		font-size: var(--tr-text-sm);
	}
	.back a {
		color: var(--tr-color-accent);
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--tr-space-sm);
		margin: var(--tr-space-md) 0;
	}
	.totals div {
		display: grid;
		gap: 2px;
		padding: var(--tr-space-sm) var(--tr-space-md);
		background: var(--tr-color-surface);
		border-radius: var(--tr-radius-md);
		min-width: 0;
		font-weight: var(--tr-weight-bold);
	}
	.totals span {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-regular);
	}
	.totals :global(.money) {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.filters {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-md);
	}
	.search {
		position: relative;
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		color: var(--tr-color-text-muted);
	}
	.search :global(.icon) {
		position: absolute;
		left: var(--tr-space-md);
	}
	.search input {
		padding-inline-start: 2.75rem;
	}
	.filters select {
		font-size: var(--tr-text-sm);
		min-width: 0;
	}
	@media (min-width: 900px) {
		.filters {
			grid-template-columns: 2fr 1fr 1fr 1fr;
		}
		.search {
			grid-column: auto;
		}
	}
</style>
