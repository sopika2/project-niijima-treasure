<script lang="ts" module>
	export interface RecurringValues {
		name: string;
		kind: 'income' | 'expense' | 'transfer';
		amount: string;
		accountId: string;
		categoryId: string;
		toAccountId: string;
		date: string;
		freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
		interval: string;
		dayOfMonth: string;
		endDate: string;
		autoPost: boolean;
		amountVaries: boolean;
	}
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Field, Segmented, useUi } from '@treasure/ui';
	import { ordinal } from '#lib/format.ts';
	import { errorText, submitter, type Errors } from '#lib/forms.ts';
	import type { AccountOption, CategoryOption } from '#lib/types.ts';

	interface Props {
		id?: string;
		accounts: readonly AccountOption[];
		categories: readonly CategoryOption[];
		initial: RecurringValues;
		onsaved: () => void;
	}

	let { id, accounts, categories, initial, onsaved }: Props = $props();
	const ui = useUi();
	const words = $derived(ui.copy.recurring);
	const uid = $props.id();

	// svelte-ignore state_referenced_locally
	let values = $state<RecurringValues>({ ...initial });
	let errors = $state<Errors>({});
	let busy = $state(false);

	const from = $derived(accounts.find((account) => account.id === values.accountId));
	const shownCategories = $derived(
		values.kind === 'transfer' ? [] : categories.filter((category) => category.kind === values.kind)
	);
	$effect(() => {
		if (
			values.categoryId &&
			!shownCategories.some((category) => category.id === values.categoryId)
		) {
			values.categoryId = '';
		}
	});

	const message = (field: string) => errorText(ui.copy, errors, field);
	const kinds = $derived([
		{ value: 'expense' as const, label: ui.copy.terms.expense, tone: 'expense' as const },
		{ value: 'income' as const, label: ui.copy.terms.income, tone: 'income' as const },
		{ value: 'transfer' as const, label: ui.copy.terms.transfer, tone: 'neutral' as const }
	]);
	const many = $derived(Number(values.interval) > 1);
	const units = $derived([
		{ value: 'daily', label: many ? words.units_daily : words.unit_daily },
		{ value: 'weekly', label: many ? words.units_weekly : words.unit_weekly },
		{ value: 'monthly', label: many ? words.units_monthly : words.unit_monthly },
		{ value: 'yearly', label: many ? words.units_yearly : words.unit_yearly }
	]);
	/** The day the first date falls on is the natural default for "day of the month". */
	const startDay = $derived(Number(values.date.slice(8, 10)) || 1);
</script>

<form
	method="POST"
	action="/recurring?/save"
	class="form"
	data-kind={values.kind}
	use:enhance={(input) => {
		busy = true;
		const after = submitter(onsaved, (next) => (errors = next))(input);
		return async (options) => {
			busy = false;
			await after(options);
		};
	}}
>
	{#if id}<input type="hidden" name="id" value={id} />{/if}
	<Segmented name="kind" label={ui.copy.form.kind} options={kinds} bind:value={values.kind} />

	<Field label={ui.copy.form.name} for="{uid}-name" error={message('name')}>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="{uid}-name"
			name="name"
			maxlength="60"
			autocomplete="off"
			placeholder={words.name_placeholder}
			autofocus
			bind:value={values.name}
		/>
	</Field>

	<Field label={ui.copy.form.amount} for="{uid}-amount" error={message('amount')}>
		<div class="amount-input">
			<input
				id="{uid}-amount"
				name="amount"
				inputmode="decimal"
				autocomplete="off"
				placeholder="0"
				bind:value={values.amount}
			/>
			<span class="currency">{from?.currency ?? ''}</span>
		</div>
	</Field>

	<div class="pair">
		<Field
			label={values.kind === 'transfer' ? ui.copy.form.from_account : ui.copy.form.account}
			for="{uid}-account"
			error={message('accountId')}
		>
			<select id="{uid}-account" name="accountId" bind:value={values.accountId}>
				{#each accounts as account (account.id)}
					<option value={account.id}>{account.name} · {account.currency}</option>
				{/each}
			</select>
		</Field>
		{#if values.kind === 'transfer'}
			<Field label={ui.copy.form.to_account} for="{uid}-to" error={message('toAccountId')}>
				<select id="{uid}-to" name="toAccountId" bind:value={values.toAccountId}>
					<option value="" disabled>—</option>
					{#each accounts as account (account.id)}
						{#if account.id !== values.accountId}
							<option value={account.id}>{account.name} · {account.currency}</option>
						{/if}
					{/each}
				</select>
			</Field>
		{:else}
			<Field label={ui.copy.form.category} for="{uid}-category" error={message('categoryId')}>
				<select id="{uid}-category" name="categoryId" bind:value={values.categoryId}>
					<option value="">—</option>
					{#each shownCategories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</Field>
		{/if}
	</div>

	<fieldset class="schedule">
		<legend>{words.every}</legend>
		<div class="every">
			<input
				name="interval"
				type="number"
				min="1"
				max="366"
				inputmode="numeric"
				aria-label={words.every}
				bind:value={values.interval}
			/>
			<select name="freq" aria-label={words.every} bind:value={values.freq}>
				{#each units as unit (unit.value)}<option value={unit.value}>{unit.label}</option>{/each}
			</select>
		</div>
		{#if values.freq === 'monthly'}
			<Field label={words.day_of_month} for="{uid}-day" error={message('dayOfMonth')}>
				<select id="{uid}-day" name="dayOfMonth" bind:value={values.dayOfMonth}>
					<option value="">{ordinal(startDay, ui.locale)}</option>
					{#each Array.from({ length: 31 }, (_, i) => i + 1) as day (day)}
						{#if day !== startDay}<option value={String(day)}>{ordinal(day, ui.locale)}</option
							>{/if}
					{/each}
					<option value="-1">{words.last_day}</option>
				</select>
			</Field>
		{/if}
		{#if message('interval') || message('freq')}
			<p class="error">{message('interval') ?? message('freq')}</p>
		{/if}
	</fieldset>

	<div class="pair">
		<Field label={words.starts} for="{uid}-start" error={message('date')}>
			<input id="{uid}-start" type="date" name="date" bind:value={values.date} />
		</Field>
		<Field
			label="{words.ends} ({ui.copy.form.optional})"
			for="{uid}-end"
			error={message('endDate')}
		>
			<input id="{uid}-end" type="date" name="endDate" bind:value={values.endDate} />
		</Field>
	</div>

	<label class="check">
		<input type="checkbox" name="autoPost" bind:checked={values.autoPost} />
		<span><strong>{words.auto_post}</strong><small>{words.auto_post_hint}</small></span>
	</label>
	<label class="check">
		<input type="checkbox" name="amountVaries" bind:checked={values.amountVaries} />
		<span><strong>{words.amount_varies}</strong><small>{words.amount_varies_hint}</small></span>
	</label>

	{#if errors.form}<p class="error">{message('form')}</p>{/if}
	<Button type="submit" {busy}>{ui.copy.actions.save}</Button>
</form>

<style>
	.form {
		display: grid;
		gap: var(--tr-space-md);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--tr-space-md);
	}
	.amount-input {
		position: relative;
		display: flex;
		align-items: center;
	}
	.amount-input input {
		min-height: 3.5rem;
		padding-inline-end: 4rem;
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
		font-size: var(--tr-text-xl);
		font-weight: var(--tr-weight-bold);
	}
	[data-kind='expense'] .amount-input input {
		color: var(--tr-color-expense);
	}
	[data-kind='income'] .amount-input input {
		color: var(--tr-color-income);
	}
	.currency {
		position: absolute;
		right: var(--tr-space-md);
		color: var(--tr-color-text-muted);
		font-weight: var(--tr-weight-bold);
		pointer-events: none;
	}
	.schedule {
		display: grid;
		gap: var(--tr-space-sm);
		margin: 0;
		padding: var(--tr-space-md);
		border: 0;
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
		background: var(--tr-color-surface);
	}
	.schedule legend {
		float: left;
		margin-block-end: var(--tr-space-xs);
		padding: 0;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		text-transform: var(--tr-heading-case);
	}
	.every {
		clear: both;
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--tr-space-sm);
	}
	.check {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: var(--tr-space-sm);
		cursor: pointer;
	}
	.check input {
		margin-block-start: 0.3rem;
	}
	.check span {
		display: grid;
	}
	.check small {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	.error {
		margin: 0;
		color: var(--tr-color-danger);
		font-size: var(--tr-text-xs);
	}
</style>
