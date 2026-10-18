<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Badge,
		Button,
		Card,
		EmptyState,
		Field,
		Icon,
		Money,
		PageHeader,
		Sheet,
		useUi
	} from '@treasure/ui';
	import { notify } from '#lib/toast.svelte.ts';
	import type { SubmitFunction } from '$app/forms';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.accounts);
	const uid = $props.id();

	type AccountRow = (typeof data.accounts)[number];
	type CategoryRow = (typeof data.categories)[number];

	const active = $derived(data.accounts.filter((account) => !account.archived));
	const archived = $derived(data.accounts.filter((account) => account.archived));

	/* ── Account sheet ─────────────────────────────────────────────────────── */
	let editing = $state<AccountRow | 'new' | null>(null);
	let accountErrors = $state<Record<string, string>>({});
	const blank = () => ({
		name: '',
		type: 'current',
		currency: ui.baseCurrency,
		openingBalance: '',
		openingDate: page.data.today as string,
		includeInTotal: true
	});
	let accountValues = $state(blank());

	function openAccount(account: AccountRow | 'new') {
		accountErrors = {};
		accountValues = account === 'new' ? blank() : { ...account.form };
		editing = account;
	}

	$effect(() => {
		if (page.url.searchParams.get('new') === '1') {
			openAccount('new');
			goto('/accounts', { replace: true, reset: false });
		}
	});

	/* ── Category sheet ────────────────────────────────────────────────────── */
	let renaming = $state<CategoryRow | null>(null);
	let categoryErrors = $state<Record<string, string>>({});
	let categoryName = $state('');
	let newNames = $state<Record<'income' | 'expense', string>>({ income: '', expense: '' });

	function openCategory(category: CategoryRow) {
		categoryErrors = {};
		categoryName = category.name;
		renaming = category;
	}

	const error = (errors: Record<string, string>, field: string) => {
		const code = errors[field];
		return code
			? (ui.copy.errors[code as keyof typeof ui.copy.errors] ?? ui.copy.errors.generic)
			: null;
	};

	/** Shared submit handling: close the sheet and toast on success, show field errors otherwise. */
	function handle(
		onSuccess: () => void,
		setErrors: (errors: Record<string, string>) => void
	): SubmitFunction {
		return () =>
			async ({ result }) => {
				if (result.type === 'success') {
					setErrors({});
					await invalidateAll();
					onSuccess();
				} else if (result.type === 'failure') {
					setErrors((result.data?.errors as Record<string, string>) ?? { form: 'generic' });
				} else {
					setErrors({ form: 'generic' });
				}
			};
	}

	const typeLabel = (type: string) =>
		ui.copy.account_types[type as keyof typeof ui.copy.account_types] ?? type;
	const groups = $derived([
		{ kind: 'expense' as const, title: ui.copy.categories.expense },
		{ kind: 'income' as const, title: ui.copy.categories.income }
	]);
</script>

<PageHeader title={words.title} subtitle={words.subtitle}>
	{#snippet actions()}
		<Button onclick={() => openAccount('new')}><Icon name="plus" />{words.new}</Button>
	{/snippet}
</PageHeader>

{#if active.length === 0}
	<EmptyState message={ui.copy.dashboard.no_accounts}>
		<Button onclick={() => openAccount('new')}
			><Icon name="plus" />{ui.copy.dashboard.add_account}</Button
		>
	</EmptyState>
{:else}
	<ul class="accounts">
		{#each active as account (account.id)}
			<li>
				<button type="button" class="account" onclick={() => openAccount(account)}>
					<span class="top">
						<span class="type">{typeLabel(account.type)}</span>
						{#if !account.includeInTotal}<Badge>{words.excluded}</Badge>{/if}
					</span>
					<span class="name">{account.name}</span>
					<Money amount={account.balance} currency={account.currency} size="lg" />
					<span class="edit"><Icon name="edit" size="1em" /></span>
				</button>
			</li>
		{/each}
	</ul>
{/if}

{#if archived.length > 0}
	<details class="archived">
		<summary>{words.archived} ({archived.length})</summary>
		<ul>
			{#each archived as account (account.id)}
				<li>
					<span
						>{account.name} · <Money
							amount={account.balance}
							currency={account.currency}
							size="sm"
						/></span
					>
					<form
						method="POST"
						action="?/archiveAccount"
						use:enhance={handle(
							() => notify(words.saved),
							() => {}
						)}
					>
						<input type="hidden" name="id" value={account.id} />
						<input type="hidden" name="archived" value="false" />
						<Button type="submit" variant="ghost">{words.restore}</Button>
					</form>
				</li>
			{/each}
		</ul>
	</details>
{/if}

<h2 class="section">{ui.copy.categories.title}</h2>
<div class="categories">
	{#each groups as group (group.kind)}
		{@const list = data.categories.filter((category) => category.kind === group.kind)}
		<Card title={group.title}>
			<ul class="category-list">
				{#each list as category (category.id)}
					<li class:muted={category.archived}>
						<span class="dot" style="--chip: var(--tr-chart-{category.color})"></span>
						<span class="category-name">{category.name}</span>
						<span class="used">{category.used || ''}</span>
						{#if category.archived}
							<form
								method="POST"
								action="?/archiveCategory"
								use:enhance={handle(
									() => notify(ui.copy.categories.saved),
									() => {}
								)}
							>
								<input type="hidden" name="id" value={category.id} />
								<input type="hidden" name="archived" value="false" />
								<button class="icon-button" type="submit" aria-label={ui.copy.categories.restore}
									><Icon name="archive" size="1em" /></button
								>
							</form>
						{:else}
							<button
								class="icon-button"
								type="button"
								onclick={() => openCategory(category)}
								aria-label="{ui.copy.actions.edit} {category.name}"
							>
								<Icon name="edit" size="1em" />
							</button>
						{/if}
					</li>
				{:else}
					<li class="muted">{ui.copy.categories.empty}</li>
				{/each}
			</ul>
			<form
				class="new-category"
				method="POST"
				action="?/saveCategory"
				use:enhance={handle(
					() => {
						newNames[group.kind] = '';
						notify(ui.copy.categories.saved);
					},
					(errors) => (categoryErrors = errors)
				)}
			>
				<input type="hidden" name="kind" value={group.kind} />
				<input
					name="name"
					maxlength="40"
					placeholder={ui.copy.categories.new}
					aria-label={ui.copy.categories.new}
					bind:value={newNames[group.kind]}
				/>
				<button class="icon-button add" type="submit" aria-label={ui.copy.actions.add}
					><Icon name="plus" /></button
				>
			</form>
		</Card>
	{/each}
</div>

<Sheet
	open={editing !== null}
	title={editing === 'new' ? words.new : words.edit}
	closeLabel={ui.copy.actions.close}
	onclose={() => (editing = null)}
>
	<form
		class="sheet-form"
		method="POST"
		action="?/saveAccount"
		use:enhance={handle(
			() => {
				editing = null;
				notify(words.saved);
			},
			(errors) => (accountErrors = errors)
		)}
	>
		{#if editing && editing !== 'new'}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label={ui.copy.form.name} for="{uid}-name" error={error(accountErrors, 'name')}>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="{uid}-name"
				name="name"
				maxlength="60"
				autocomplete="off"
				autofocus
				bind:value={accountValues.name}
			/>
		</Field>
		<div class="pair">
			<Field label={ui.copy.form.type} for="{uid}-type" error={error(accountErrors, 'type')}>
				<select id="{uid}-type" name="type" bind:value={accountValues.type}>
					{#each Object.entries(ui.copy.account_types) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</Field>
			<Field
				label={ui.copy.form.currency}
				for="{uid}-currency"
				error={error(accountErrors, 'currency')}
				hint={editing && editing !== 'new' && editing.locked ? words.currency_locked : undefined}
			>
				<select
					id="{uid}-currency"
					name="currency"
					bind:value={accountValues.currency}
					disabled={editing !== 'new' && !!editing?.locked}
				>
					{#each data.currencies as currency (currency)}<option value={currency}>{currency}</option
						>{/each}
				</select>
				{#if editing !== 'new' && editing?.locked}<input
						type="hidden"
						name="currency"
						value={accountValues.currency}
					/>{/if}
			</Field>
		</div>
		<div class="pair">
			<Field
				label={words.opening_balance}
				for="{uid}-opening"
				error={error(accountErrors, 'openingBalance')}
			>
				<input
					id="{uid}-opening"
					name="openingBalance"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0"
					bind:value={accountValues.openingBalance}
				/>
			</Field>
			<Field
				label={words.opening_date}
				for="{uid}-date"
				error={error(accountErrors, 'openingDate')}
			>
				<input
					id="{uid}-date"
					name="openingDate"
					type="date"
					bind:value={accountValues.openingDate}
				/>
			</Field>
		</div>
		<label class="check">
			<input type="checkbox" name="includeInTotal" bind:checked={accountValues.includeInTotal} />
			{words.include_in_total}
		</label>
		{#if accountErrors.form}<p class="form-error">{error(accountErrors, 'form')}</p>{/if}
		<Button type="submit">{ui.copy.actions.save}</Button>
	</form>
	{#if editing && editing !== 'new'}
		<form
			method="POST"
			action="?/archiveAccount"
			use:enhance={handle(
				() => {
					editing = null;
					notify(words.saved);
				},
				() => {}
			)}
		>
			<input type="hidden" name="id" value={editing.id} />
			<input type="hidden" name="archived" value="true" />
			<Button type="submit" variant="danger"><Icon name="archive" />{words.archive}</Button>
		</form>
	{/if}
</Sheet>

<Sheet
	open={renaming !== null}
	title={ui.copy.actions.edit}
	closeLabel={ui.copy.actions.close}
	onclose={() => (renaming = null)}
>
	{#if renaming}
		<form
			class="sheet-form"
			method="POST"
			action="?/saveCategory"
			use:enhance={handle(
				() => {
					renaming = null;
					notify(ui.copy.categories.saved);
				},
				(errors) => (categoryErrors = errors)
			)}
		>
			<input type="hidden" name="id" value={renaming.id} />
			<Field label={ui.copy.form.name} for="{uid}-category" error={error(categoryErrors, 'name')}>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="{uid}-category"
					name="name"
					maxlength="40"
					autocomplete="off"
					autofocus
					bind:value={categoryName}
				/>
			</Field>
			<Button type="submit">{ui.copy.actions.save}</Button>
		</form>
		<form
			method="POST"
			action="?/archiveCategory"
			use:enhance={handle(
				() => {
					renaming = null;
					notify(ui.copy.categories.saved);
				},
				() => {}
			)}
		>
			<input type="hidden" name="id" value={renaming.id} />
			<input type="hidden" name="archived" value="true" />
			<Button type="submit" variant="danger"
				><Icon name="archive" />{ui.copy.categories.archive}</Button
			>
		</form>
	{/if}
</Sheet>

{#if categoryErrors.name && !renaming}
	<p class="form-error floating">{error(categoryErrors, 'name')}</p>
{/if}

<style>
	.accounts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--tr-space-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.account {
		position: relative;
		display: grid;
		gap: var(--tr-space-xs);
		width: 100%;
		padding: var(--tr-space-lg);
		border: 0;
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
		background: var(--tr-color-surface);
		color: var(--tr-color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
		transition: background-color var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.account:hover {
		background: var(--tr-color-surface-raised);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--tr-space-sm);
	}
	.type {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.name {
		font-family: var(--tr-font-heading);
		font-weight: var(--tr-weight-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-lg);
	}
	.edit {
		position: absolute;
		top: var(--tr-space-md);
		right: calc(var(--tr-cut) + var(--tr-space-sm));
		color: var(--tr-color-text-muted);
	}

	.archived {
		margin-block-start: var(--tr-space-lg);
		color: var(--tr-color-text-muted);
	}
	.archived summary {
		cursor: pointer;
	}
	.archived ul {
		display: grid;
		gap: var(--tr-space-sm);
		margin: var(--tr-space-sm) 0 0;
		padding: 0;
		list-style: none;
	}
	.archived li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--tr-space-md);
	}

	.section {
		margin: var(--tr-space-xl) 0 var(--tr-space-md);
		font-size: var(--tr-text-xl);
	}
	.categories {
		display: grid;
		gap: var(--tr-space-lg);
	}
	@media (min-width: 900px) {
		.categories {
			grid-template-columns: 1fr 1fr;
		}
	}
	.category-list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.category-list li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--tr-space-sm);
		min-height: 2.75rem;
		border-bottom: var(--tr-border-width) solid var(--tr-color-border);
	}
	.category-list li.muted {
		color: var(--tr-color-text-muted);
	}
	.category-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.used {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		font-variant-numeric: var(--tr-numeric);
	}
	.dot {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 50%;
		background: var(--chip);
	}
	.icon-button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: var(--tr-radius-md);
		background: transparent;
		color: var(--tr-color-text-muted);
		cursor: pointer;
	}
	.icon-button:hover {
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text);
	}
	.icon-button.add {
		width: 2.75rem;
		height: 2.75rem;
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	.new-category {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--tr-space-sm);
	}

	.sheet-form {
		display: grid;
		gap: var(--tr-space-md);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--tr-space-md);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--tr-space-sm);
	}
	.form-error {
		margin: 0;
		color: var(--tr-color-danger);
		font-size: var(--tr-text-sm);
	}
	.floating {
		margin-block-start: var(--tr-space-md);
	}
</style>
