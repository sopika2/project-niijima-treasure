<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Badge,
		Button,
		Card,
		DateTag,
		EmptyState,
		Icon,
		Money,
		PageHeader,
		Sheet,
		useUi
	} from '@treasure/ui';
	import RecurringForm, { type RecurringValues } from '#lib/components/RecurringForm.svelte';
	import { errorText, submitter, type Errors } from '#lib/forms.ts';
	import { notify } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.recurring);

	type Rule = (typeof data.rules)[number];
	let editing = $state<Rule | 'new' | null>(null);
	let pendingErrors = $state<Record<string, Errors>>({});

	const blank = (): RecurringValues => ({
		name: '',
		kind: 'expense',
		amount: '',
		accountId: page.data.accounts[0]?.id ?? '',
		categoryId: '',
		toAccountId: page.data.accounts[1]?.id ?? '',
		date: page.data.today,
		freq: 'monthly',
		interval: '1',
		dayOfMonth: '',
		endDate: '',
		autoPost: true,
		amountVaries: false
	});

	const unit = (freq: string) =>
		({
			daily: words.unit_daily,
			weekly: words.unit_weekly,
			monthly: words.unit_monthly,
			yearly: words.unit_yearly
		})[freq] ?? freq;
	const every = (rule: Rule) =>
		`${words.every} ${rule.interval > 1 ? `${rule.interval} ` : ''}${unit(rule.freq)}${
			rule.freq === 'monthly' && rule.dayOfMonth
				? ` · ${rule.dayOfMonth === -1 ? words.last_day : `${rule.dayOfMonth}.`}`
				: ''
		}`;
	const signed = (rule: Rule) =>
		rule.kind === 'expense' ? -rule.amount : rule.kind === 'income' ? rule.amount : rule.amount;

	const active = $derived(data.rules.filter((rule) => !rule.paused && rule.nextDue));
	const resting = $derived(data.rules.filter((rule) => rule.paused || !rule.nextDue));
</script>

<PageHeader title={words.title} subtitle={words.subtitle}>
	{#snippet actions()}
		<Button onclick={() => (editing = 'new')}><Icon name="plus" />{words.new}</Button>
	{/snippet}
</PageHeader>

{#if data.pending.length > 0}
	<Card title={words.waiting} accent>
		<p class="hint">{words.waiting_hint}</p>
		<ul class="pending">
			{#each data.pending as item (item.id)}
				{@const errors = pendingErrors[item.id] ?? {}}
				<li>
					<DateTag date={item.date} tone="accent" />
					<div class="pending-main">
						<strong class="name">{item.note ?? item.category?.name ?? ui.copy.terms.expense}</strong
						>
						<span class="meta">{item.account}{item.toAccount ? ` → ${item.toAccount}` : ''}</span>
					</div>
					<form
						class="pending-form"
						method="POST"
						action="?/confirm"
						use:enhance={submitter(
							() => notify(words.confirmed),
							(next) => (pendingErrors = { ...pendingErrors, [item.id]: next })
						)}
					>
						<input type="hidden" name="id" value={item.id} />
						<label class="amount">
							<span class="visually-hidden">{ui.copy.form.amount}</span>
							<input name="amount" inputmode="decimal" autocomplete="off" value={item.typed} />
							<span class="currency">{item.currency}</span>
						</label>
						<Button type="submit"><Icon name="check" />{words.confirm}</Button>
						{#if errorText(ui.copy, errors, 'amount')}
							<p class="error">{errorText(ui.copy, errors, 'amount')}</p>
						{/if}
					</form>
					<form method="POST" action="?/skip" use:enhance={submitter(() => notify(words.skipped))}>
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="ghost">{words.skip}</Button>
					</form>
				</li>
			{/each}
		</ul>
	</Card>
{/if}

{#if data.rules.length === 0}
	<EmptyState message={words.empty}>
		<Button onclick={() => (editing = 'new')}><Icon name="plus" />{words.new}</Button>
	</EmptyState>
{:else}
	<div class="total">
		<span class="total-label">{ui.copy.terms.total} · {words.per_month}</span>
		<span class="display-number"
			><Money amount={data.monthly} currency={ui.baseCurrency} signed tone="auto" size="xl" /></span
		>
	</div>

	<ol class="rules">
		{#each active as rule (rule.id)}
			<li>
				<button type="button" class="rule" data-kind={rule.kind} onclick={() => (editing = rule)}>
					<DateTag date={rule.nextDue} />
					<span class="rule-main">
						<span class="name">{rule.name}</span>
						<span class="meta">
							{every(rule)} · {rule.account}{rule.toAccount
								? ` → ${rule.toAccount}`
								: ''}{rule.category ? ` · ${rule.category}` : ''}
						</span>
						<span class="badges">
							{#if !rule.autoPost || rule.amountVaries}<Badge tone="secondary"
									>{words.confirm}</Badge
								>{/if}
						</span>
					</span>
					<span class="rule-amount">
						<Money
							amount={signed(rule)}
							currency={rule.currency}
							signed={rule.kind !== 'transfer'}
							tone={rule.kind === 'transfer' ? 'none' : 'auto'}
							size="lg"
						/>
						{#if rule.perMonth !== null && (rule.freq !== 'monthly' || rule.interval !== 1 || rule.currency !== ui.baseCurrency)}
							<small
								><Money amount={rule.perMonth} currency={ui.baseCurrency} />
								{words.per_month}</small
							>
						{/if}
					</span>
				</button>
			</li>
		{/each}
	</ol>

	{#if resting.length > 0}
		<h2 class="section">{words.paused} / {words.ended}</h2>
		<ol class="rules resting">
			{#each resting as rule (rule.id)}
				<li>
					<button type="button" class="rule" data-kind={rule.kind} onclick={() => (editing = rule)}>
						<DateTag date={null} tone="muted" />
						<span class="rule-main">
							<span class="name">{rule.name}</span>
							<span class="meta">{every(rule)} · {rule.account}</span>
							<span class="badges"><Badge>{rule.paused ? words.paused : words.ended}</Badge></span>
						</span>
						<span class="rule-amount">
							<Money amount={signed(rule)} currency={rule.currency} size="lg" />
						</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
{/if}

<Sheet
	open={editing !== null}
	title={editing === 'new' ? words.new : words.edit}
	closeLabel={ui.copy.actions.close}
	onclose={() => (editing = null)}
>
	{#if editing}
		{#key editing === 'new' ? 'new' : editing.id}
			<RecurringForm
				id={editing === 'new' ? undefined : editing.id}
				accounts={page.data.accounts}
				categories={page.data.categories}
				initial={editing === 'new' ? blank() : (editing.form as RecurringValues)}
				onsaved={() => {
					editing = null;
					notify(words.saved);
				}}
			/>
		{/key}
		{#if editing !== 'new'}
			{@const rule = editing}
			<div class="sheet-actions">
				<form
					method="POST"
					action="?/pause"
					use:enhance={submitter(() => {
						editing = null;
						notify(words.saved);
					})}
				>
					<input type="hidden" name="id" value={rule.id} />
					<input type="hidden" name="paused" value={rule.paused ? 'false' : 'true'} />
					<Button type="submit" variant="secondary"
						><Icon name={rule.paused ? 'repeat' : 'archive'} />{rule.paused
							? words.resume
							: words.pause}</Button
					>
				</form>
				<form
					method="POST"
					action="?/remove"
					use:enhance={(input) => {
						if (!confirm(words.delete_confirm)) {
							input.cancel();
							return;
						}
						return submitter(() => {
							editing = null;
							notify(words.deleted);
						})(input);
					}}
				>
					<input type="hidden" name="id" value={rule.id} />
					<Button type="submit" variant="danger"><Icon name="trash" />{words.delete}</Button>
				</form>
			</div>
		{/if}
	{/if}
</Sheet>

<style>
	.hint {
		margin: 0 0 var(--tr-space-md);
		color: var(--tr-color-text-muted);
	}
	.pending {
		display: grid;
		gap: var(--tr-space-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pending li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--tr-space-sm) var(--tr-space-md);
		padding-block-end: var(--tr-space-md);
		border-bottom: var(--tr-border-width) solid var(--tr-color-border);
	}
	.pending li:last-child {
		border-bottom: 0;
		padding-block-end: 0;
	}
	.pending-main {
		display: grid;
		min-width: 0;
	}
	.pending-form {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--tr-space-sm);
	}
	@media (min-width: 720px) {
		.pending li {
			grid-template-columns: auto minmax(0, 1fr) minmax(16rem, 22rem) auto;
		}
		.pending-form {
			grid-column: auto;
		}
	}
	.amount {
		position: relative;
		display: flex;
		align-items: center;
	}
	.amount input {
		padding-inline-end: 3.5rem;
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
		font-weight: var(--tr-weight-bold);
	}
	.currency {
		position: absolute;
		right: var(--tr-space-sm);
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
		pointer-events: none;
	}
	.error {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--tr-color-danger);
		font-size: var(--tr-text-xs);
	}

	.total {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--tr-space-sm);
		margin-block: var(--tr-space-lg) var(--tr-space-md);
		padding-block-end: var(--tr-space-sm);
		border-bottom: var(--tr-accent-border-width) solid var(--tr-color-accent);
	}
	.total-label {
		color: var(--tr-color-text-muted);
	}

	.rules {
		display: grid;
		gap: var(--tr-space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rule {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--tr-space-md);
		width: 100%;
		padding: var(--tr-space-sm) var(--tr-space-md) var(--tr-space-sm) var(--tr-space-sm);
		border: 0;
		background: var(--tr-color-surface);
		color: var(--tr-color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		clip-path: polygon(0 0, 100% 0, calc(100% - var(--tr-cut) / 2) 100%, 0 100%);
		transition:
			background-color var(--tr-duration-fast) var(--tr-ease-standard),
			color var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.rule:hover,
	.rule:focus-visible {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		outline: none;
	}
	.rule:hover .meta,
	.rule:focus-visible .meta {
		color: var(--tr-color-ink);
	}
	.rule-main {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		font-weight: var(--tr-weight-heading);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		overflow: hidden;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badges:empty {
		display: none;
	}
	.rule-amount {
		display: grid;
		justify-items: end;
		gap: 2px;
	}
	.rule-amount small {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
	.resting .rule {
		opacity: 0.7;
	}
	.section {
		margin: var(--tr-space-xl) 0 var(--tr-space-md);
		font-size: var(--tr-text-lg);
	}
	.sheet-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tr-space-sm);
		margin-block-start: var(--tr-space-lg);
		padding-block-start: var(--tr-space-md);
		border-top: var(--tr-border-width) solid var(--tr-color-border);
	}
</style>
