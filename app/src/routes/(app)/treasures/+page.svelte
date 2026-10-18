<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Badge,
		Button,
		EmptyState,
		Field,
		Icon,
		Money,
		PageHeader,
		Progress,
		Sheet,
		useUi
	} from '@treasure/ui';
	import { errorText, submitter, type Errors } from '#lib/forms.ts';
	import { notify } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.treasures);
	const uid = $props.id();

	type Goal = (typeof data.goals)[number];
	let editing = $state<Goal | 'new' | null>(null);
	let errors = $state<Errors>({});
	let values = $state({ name: '', target: '', currency: '', deadline: '', accountId: '' });
	let putErrors = $state<Record<string, Errors>>({});

	function open(goal: Goal | 'new') {
		errors = {};
		values =
			goal === 'new'
				? { name: '', target: '', currency: ui.baseCurrency, deadline: '', accountId: '' }
				: { ...goal.form };
		editing = goal;
	}

	const active = $derived(data.goals.filter((goal) => !goal.archived));
	const archived = $derived(data.goals.filter((goal) => goal.archived));
	const linked = $derived(data.accounts.find((account) => account.id === values.accountId));
	const percent = (share: number) =>
		new Intl.NumberFormat(ui.locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);
	const monthYear = (iso: string) =>
		new Intl.DateTimeFormat(ui.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${iso}T00:00:00Z`)
		);
	const message = (field: string) => errorText(ui.copy, errors, field);
</script>

<PageHeader title={words.title} subtitle={words.subtitle}>
	{#snippet actions()}
		<Button onclick={() => open('new')}><Icon name="plus" />{words.new}</Button>
	{/snippet}
</PageHeader>

{#if active.length === 0}
	<EmptyState message={words.empty}>
		<Button onclick={() => open('new')}><Icon name="gem" />{words.new}</Button>
	</EmptyState>
{:else}
	<ul class="treasures">
		{#each active as goal (goal.id)}
			{@const errs = putErrors[goal.id] ?? {}}
			<li class="treasure" class:reached={goal.reached}>
				<div class="card-head">
					<h2 class="name">{goal.name}</h2>
					<button
						class="icon-button"
						type="button"
						aria-label="{ui.copy.actions.edit} {goal.name}"
						onclick={() => open(goal)}
					>
						<Icon name="edit" size="1em" />
					</button>
				</div>
				<div class="score">
					<span class="percent">{percent(goal.progress)}</span>
					<span class="amounts">
						<Money amount={goal.savedMinor} currency={goal.currency} size="lg" />
						<span class="of">/ <Money amount={goal.targetMinor} currency={goal.currency} /></span>
					</span>
				</div>
				<Progress
					label={goal.name}
					value={goal.progress}
					tone={goal.reached ? 'income' : goal.late ? 'warning' : 'accent'}
				/>
				<dl class="facts">
					{#if goal.reached}
						<div>
							<dt class="visually-hidden">{words.saved}</dt>
							<dd><Badge tone="success">{words.reached}</Badge></dd>
						</div>
					{:else}
						{#if goal.deadline}
							<div>
								<dt>{words.deadline}</dt>
								<dd>
									{monthYear(goal.deadline)}
									{#if goal.late}<Badge tone="warning">{words.late}</Badge>{/if}
								</dd>
							</div>
						{/if}
						{#if goal.neededPerMonthMinor !== null}
							<div>
								<dt>{words.needed}</dt>
								<dd><Money amount={goal.neededPerMonthMinor} currency={goal.currency} /></dd>
							</div>
						{/if}
						<div>
							<dt>{words.eta}</dt>
							<dd>{goal.projectedDate ? monthYear(goal.projectedDate) : words.no_pace}</dd>
						</div>
					{/if}
					<div>
						<dt class="visually-hidden">{words.linked_account}</dt>
						<dd class="muted">
							{goal.accountName ? `${words.linked_account}: ${goal.accountName}` : words.not_linked}
						</dd>
					</div>
				</dl>
				{#if !goal.accountId && !goal.reached}
					<form
						class="put"
						method="POST"
						action="?/contribute"
						use:enhance={submitter(
							() => notify(words.contribution_saved),
							(next) => (putErrors = { ...putErrors, [goal.id]: next })
						)}
					>
						<input type="hidden" name="id" value={goal.id} />
						<label class="amount">
							<span class="visually-hidden">{words.put_in}</span>
							<input
								name="amount"
								inputmode="decimal"
								autocomplete="off"
								placeholder={words.put_in}
							/>
							<span class="currency">{goal.currency}</span>
						</label>
						<Button type="submit" variant="secondary"
							><Icon name="plus" />{ui.copy.actions.add}</Button
						>
						{#if errorText(ui.copy, errs, 'amount')}<p class="error">
								{errorText(ui.copy, errs, 'amount')}
							</p>{/if}
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if archived.length > 0}
	<details class="archived">
		<summary>{words.archived} ({archived.length})</summary>
		<ul>
			{#each archived as goal (goal.id)}
				<li>
					<span
						>{goal.name} · <Money
							amount={goal.savedMinor}
							currency={goal.currency}
							size="sm"
						/></span
					>
					<form
						method="POST"
						action="?/archive"
						use:enhance={submitter(() => notify(words.saved_msg))}
					>
						<input type="hidden" name="id" value={goal.id} />
						<input type="hidden" name="archived" value="false" />
						<Button type="submit" variant="ghost">{words.restore}</Button>
					</form>
				</li>
			{/each}
		</ul>
	</details>
{/if}

<Sheet
	open={editing !== null}
	title={editing === 'new' ? words.new : words.edit}
	closeLabel={ui.copy.actions.close}
	onclose={() => (editing = null)}
>
	<form
		class="sheet-form"
		method="POST"
		action="?/save"
		use:enhance={submitter(
			() => {
				editing = null;
				notify(words.saved_msg);
			},
			(next) => (errors = next)
		)}
	>
		{#if editing && editing !== 'new'}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label={ui.copy.form.name} for="{uid}-name" error={message('name')}>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="{uid}-name"
				name="name"
				maxlength="60"
				autocomplete="off"
				autofocus
				bind:value={values.name}
			/>
		</Field>
		<Field
			label={words.linked_account}
			for="{uid}-account"
			hint={words.linked_hint}
			error={message('accountId')}
		>
			<select id="{uid}-account" name="accountId" bind:value={values.accountId}>
				<option value="">{words.not_linked}</option>
				{#each data.accounts as account (account.id)}
					<option value={account.id}>{account.name} · {account.currency}</option>
				{/each}
			</select>
		</Field>
		<div class="pair">
			<Field label={words.target} for="{uid}-target" error={message('target')}>
				<input
					id="{uid}-target"
					name="target"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0"
					bind:value={values.target}
				/>
			</Field>
			<Field label={ui.copy.form.currency} for="{uid}-currency">
				{#if linked}
					<input id="{uid}-currency" value={linked.currency} disabled />
				{:else}
					<select id="{uid}-currency" name="currency" bind:value={values.currency}>
						{#each data.currencies as code (code)}<option value={code}>{code}</option>{/each}
					</select>
				{/if}
			</Field>
		</div>
		<Field
			label="{words.deadline} ({ui.copy.form.optional})"
			for="{uid}-deadline"
			error={message('deadline')}
		>
			<input id="{uid}-deadline" name="deadline" type="date" bind:value={values.deadline} />
		</Field>
		{#if errors.form}<p class="error">{message('form')}</p>{/if}
		<Button type="submit">{ui.copy.actions.save}</Button>
	</form>
	{#if editing && editing !== 'new'}
		<form
			class="archive"
			method="POST"
			action="?/archive"
			use:enhance={submitter(() => {
				editing = null;
				notify(words.saved_msg);
			})}
		>
			<input type="hidden" name="id" value={editing.id} />
			<input type="hidden" name="archived" value="true" />
			<Button type="submit" variant="danger"><Icon name="archive" />{words.archive}</Button>
		</form>
	{/if}
</Sheet>

<style>
	.treasures {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
		gap: var(--tr-space-lg);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.treasure {
		position: relative;
		display: grid;
		align-content: start;
		gap: var(--tr-space-md);
		padding: var(--tr-space-lg);
		background: var(--tr-color-surface);
		box-shadow: var(--tr-shadow-raised);
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
	}
	.treasure::before {
		content: '';
		position: absolute;
		inset: 0 0 auto auto;
		width: 9rem;
		height: 9rem;
		background: radial-gradient(circle, var(--tr-color-accent) 1.4px, transparent 1.6px) 0 0 / 9px
			9px;
		mask-image: radial-gradient(circle at top right, var(--tr-color-ink), transparent 70%);
		opacity: 0.6;
		pointer-events: none;
	}
	.treasure.reached {
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-income);
	}
	.card-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--tr-space-sm);
	}
	.name {
		margin: 0;
		font-size: var(--tr-text-xl);
		line-height: 1;
	}
	.score {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--tr-space-md);
	}
	.percent {
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-xxl);
		font-weight: var(--tr-weight-heading);
		line-height: 0.9;
		color: var(--tr-color-paper);
		-webkit-text-stroke: 0;
		text-shadow: 3px 3px 0 var(--tr-color-accent);
	}
	.amounts {
		display: grid;
	}
	.of,
	.muted {
		color: var(--tr-color-text-muted);
	}
	.facts {
		display: grid;
		gap: var(--tr-space-xs);
		margin: 0;
		font-size: var(--tr-text-sm);
	}
	.facts div {
		display: flex;
		justify-content: space-between;
		gap: var(--tr-space-md);
	}
	.facts dt {
		color: var(--tr-color-text-muted);
	}
	.facts dd {
		margin: 0;
		text-align: end;
	}
	.put {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--tr-space-sm);
	}
	.amount {
		position: relative;
		display: flex;
		align-items: center;
	}
	.amount input {
		padding-inline-end: 3.5rem;
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
	.icon-button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		background: transparent;
		color: var(--tr-color-text-muted);
		cursor: pointer;
	}
	.icon-button:hover {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.archived {
		margin-block-start: var(--tr-space-xl);
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
	.archive {
		margin-block-start: var(--tr-space-lg);
	}
</style>
