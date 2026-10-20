<script lang="ts" module>
	export interface TransactionValues {
		kind: 'income' | 'expense' | 'transfer';
		date: string;
		amount: string;
		accountId: string;
		categoryId: string;
		toAccountId: string;
		toAmount: string;
		note: string;
	}
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, Field, Segmented, useUi } from '@treasure/ui';
	import type { AccountOption, CategoryOption } from '#lib/types.ts';

	interface Props {
		action: string;
		accounts: readonly AccountOption[];
		categories: readonly CategoryOption[];
		notes?: readonly string[];
		initial: TransactionValues;
		/** Remember the last type and account on this device (the Add sheet). */
		remember?: boolean;
		onsaved?: () => void;
	}

	let {
		action,
		accounts,
		categories,
		notes = [],
		initial,
		remember = false,
		onsaved
	}: Props = $props();

	const ui = useUi();
	const uid = $props.id();
	const STORE = 'treasury.add';

	// svelte-ignore state_referenced_locally
	let values = $state<TransactionValues>({ ...initial });
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	/** The Add sheet starts with the type and account used last time on this device. */
	function restoreLastUsed() {
		if (!remember || typeof localStorage === 'undefined') return;
		try {
			const saved = JSON.parse(
				localStorage.getItem(STORE) ?? 'null'
			) as Partial<TransactionValues> | null;
			if (saved?.kind && ['income', 'expense', 'transfer'].includes(saved.kind))
				values.kind = saved.kind;
			if (saved?.accountId && accounts.some((account) => account.id === saved.accountId)) {
				values.accountId = saved.accountId;
			}
		} catch {
			/* storage may be blocked; defaults are fine */
		}
	}
	restoreLastUsed();

	const from = $derived(accounts.find((account) => account.id === values.accountId));
	const to = $derived(accounts.find((account) => account.id === values.toAccountId));
	// An entry before an account's starting balance date is already part of that balance.
	const beforeOpening = $derived.by(() => {
		const early = [from, values.kind === 'transfer' ? to : undefined].find(
			(account) => account && values.date && values.date < account.openingDate
		);
		return early ? ui.copy.form.before_opening.replace('{account}', early.name) : undefined;
	});
	const crossCurrency = $derived(
		values.kind === 'transfer' && !!from && !!to && from.currency !== to.currency
	);
	const shownCategories = $derived(
		values.kind === 'transfer' ? [] : categories.filter((category) => category.kind === values.kind)
	);

	$effect(() => {
		// Switching between income and spending clears a category of the wrong kind.
		if (
			values.categoryId &&
			!shownCategories.some((category) => category.id === values.categoryId)
		) {
			values.categoryId = '';
		}
	});

	const message = (field: string) => {
		const code = errors[field];
		return code
			? (ui.copy.errors[code as keyof typeof ui.copy.errors] ?? ui.copy.errors.generic)
			: null;
	};

	const kinds = $derived([
		{ value: 'expense' as const, label: ui.copy.terms.expense, tone: 'expense' as const },
		{ value: 'income' as const, label: ui.copy.terms.income, tone: 'income' as const },
		{ value: 'transfer' as const, label: ui.copy.terms.transfer, tone: 'neutral' as const }
	]);
</script>

<form
	method="POST"
	{action}
	class="form"
	data-kind={values.kind}
	use:enhance={() => {
		busy = true;
		return async ({ result }) => {
			busy = false;
			if (result.type === 'success') {
				errors = {};
				if (remember) {
					try {
						localStorage.setItem(
							STORE,
							JSON.stringify({ kind: values.kind, accountId: values.accountId })
						);
					} catch {
						/* not important */
					}
				}
				values.amount = '';
				values.toAmount = '';
				values.note = '';
				await invalidateAll();
				onsaved?.();
			} else if (result.type === 'redirect') {
				await goto(result.location, { invalidateAll: true });
			} else if (result.type === 'failure') {
				errors = (result.data?.errors as Record<string, string> | undefined) ?? { form: 'generic' };
			} else {
				errors = { form: 'generic' };
			}
		};
	}}
>
	<Segmented name="kind" label={ui.copy.form.kind} options={kinds} bind:value={values.kind} />

	<div class="amount">
		<Field label={ui.copy.form.amount} for="{uid}-amount" error={message('amount')}>
			<div class="amount-input">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="{uid}-amount"
					name="amount"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0"
					autofocus
					bind:value={values.amount}
				/>
				<span class="currency">{from?.currency ?? ''}</span>
			</div>
		</Field>
	</div>

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
			<Field
				label={ui.copy.form.date}
				for="{uid}-date"
				error={message('date')}
				hint={beforeOpening}
			>
				<input id="{uid}-date" type="date" name="date" bind:value={values.date} />
			</Field>
		{/if}
	</div>

	{#if crossCurrency}
		<Field label={ui.copy.form.received} for="{uid}-to-amount" error={message('toAmount')}>
			<div class="amount-input small">
				<input
					id="{uid}-to-amount"
					name="toAmount"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0"
					bind:value={values.toAmount}
				/>
				<span class="currency">{to?.currency}</span>
			</div>
		</Field>
	{/if}

	{#if values.kind === 'transfer'}
		<Field label={ui.copy.form.date} for="{uid}-date" error={message('date')} hint={beforeOpening}>
			<input id="{uid}-date" type="date" name="date" bind:value={values.date} />
		</Field>
	{:else}
		<div class="field-like">
			<span class="label">
				{ui.copy.form.category}
				<span class="optional">({ui.copy.form.optional})</span>
			</span>
			<input type="hidden" name="categoryId" value={values.categoryId} />
			<div class="chips" role="group" aria-label={ui.copy.form.category}>
				{#each shownCategories as category (category.id)}
					<button
						type="button"
						class="chip"
						style="--chip: var(--tr-chart-{category.color})"
						aria-pressed={values.categoryId === category.id}
						onclick={() =>
							(values.categoryId = values.categoryId === category.id ? '' : category.id)}
					>
						<span class="dot"></span>{category.name}
					</button>
				{/each}
			</div>
			{#if message('categoryId')}<p class="error">{message('categoryId')}</p>{/if}
		</div>
	{/if}

	<Field label="{ui.copy.form.note} ({ui.copy.form.optional})" for="{uid}-note">
		<input
			id="{uid}-note"
			name="note"
			maxlength="500"
			autocomplete="off"
			list="{uid}-notes"
			placeholder={ui.copy.form.note_placeholder}
			bind:value={values.note}
		/>
		<datalist id="{uid}-notes">
			{#each notes as note (note)}<option value={note}></option>{/each}
		</datalist>
	</Field>

	{#if errors.form}<p class="error">{message('form')}</p>{/if}

	<div class="submit">
		<Button type="submit" {busy}>{ui.copy.actions.save}</Button>
	</div>
</form>

<style>
	.form {
		display: grid;
		gap: var(--tr-space-md);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: start;
		gap: var(--tr-space-md);
	}
	.amount-input {
		position: relative;
		display: flex;
		align-items: center;
	}
	.amount-input input {
		min-height: 3.75rem;
		padding-inline-end: 4rem;
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
		font-size: var(--tr-text-xl);
		font-weight: var(--tr-weight-bold);
	}
	.amount-input.small input {
		min-height: 2.75rem;
		font-size: var(--tr-text-lg);
	}
	.currency {
		position: absolute;
		right: var(--tr-space-md);
		color: var(--tr-color-text-muted);
		font-weight: var(--tr-weight-bold);
		pointer-events: none;
	}
	[data-kind='expense'] .amount-input:not(.small) input {
		color: var(--tr-color-expense);
	}
	[data-kind='income'] .amount-input:not(.small) input {
		color: var(--tr-color-income);
	}

	.field-like {
		display: grid;
		gap: var(--tr-space-xs);
	}
	.label {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
		font-weight: var(--tr-weight-medium);
	}
	.optional {
		font-weight: var(--tr-weight-regular);
		opacity: 0.8;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tr-space-xs);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-xs);
		min-height: 2.25rem;
		padding: 0 var(--tr-space-sm);
		border: var(--tr-border-width) solid var(--tr-color-border);
		border-radius: var(--tr-radius-pill);
		background: var(--tr-color-background);
		color: var(--tr-color-text);
		font: inherit;
		font-size: var(--tr-text-sm);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		border-color: var(--chip);
		background: color-mix(in srgb, var(--chip) 22%, var(--tr-color-background));
	}
	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--chip);
	}
	.error {
		margin: 0;
		color: var(--tr-color-danger);
		font-size: var(--tr-text-xs);
	}
	.submit {
		display: grid;
		margin-block-start: var(--tr-space-xs);
	}
</style>
