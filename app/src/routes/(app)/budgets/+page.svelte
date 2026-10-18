<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Button,
		Card,
		EmptyState,
		Field,
		Icon,
		Money,
		PageHeader,
		Progress,
		useUi
	} from '@treasure/ui';
	import { errorText, submitter, type Errors } from '#lib/forms.ts';
	import { notify } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.budgets);
	const uid = $props.id();

	let addErrors = $state<Errors>({});
	let rowErrors = $state<Record<string, Errors>>({});
	let editingId = $state<string | null>(null);
	let pick = $state('');
	let limit = $state('');

	const tone = (state: string) =>
		state === 'over'
			? 'danger'
			: state === 'warn'
				? 'warning'
				: state === 'pace'
					? 'secondary'
					: 'income';
	const percent = (share: number) =>
		new Intl.NumberFormat(ui.locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);
	const monthName = $derived(
		new Intl.DateTimeFormat(ui.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${data.month}-01T00:00:00Z`)
		)
	);
</script>

<PageHeader title={words.title} subtitle={words.subtitle} />

{#if data.rows.length > 0}
	<section class="overall">
		<div class="overall-text">
			<span class="label">{words.month_total} · {monthName}</span>
			<span class="display-number">
				<Money amount={data.totals.spent} currency={ui.baseCurrency} size="xl" />
			</span>
			<span class="of">/ <Money amount={data.totals.limit} currency={ui.baseCurrency} /></span>
		</div>
		<Progress
			label={words.month_total}
			value={data.totals.limit ? data.totals.spent / data.totals.limit : 0}
			marker={data.dayShare}
			tone={data.totals.spent > data.totals.limit ? 'danger' : 'accent'}
		/>
	</section>

	<ul class="budgets">
		{#each data.rows as row (row.categoryId)}
			{@const errors = rowErrors[row.categoryId] ?? {}}
			<li class="budget" data-state={row.state} style="--chip: var(--tr-chart-{row.color})">
				<div class="head">
					<span class="name"><span class="dot"></span>{row.name}</span>
					<span class="figures">
						<Money amount={row.spentMinor} currency={row.currency} size="lg" />
						<span class="of">/ <Money amount={row.limitMinor} currency={row.currency} /></span>
					</span>
				</div>
				<Progress label={row.name} value={row.used} marker={data.dayShare} tone={tone(row.state)} />
				<div class="foot">
					<span class="left" class:over={row.remainingMinor < 0}>
						{#if row.remainingMinor >= 0}
							<Money amount={row.remainingMinor} currency={row.currency} /> {words.left}
						{:else}
							<Money amount={-row.remainingMinor} currency={row.currency} /> {words.over_by}
						{/if}
						· {percent(row.used)}
					</span>
					<span class="pace">
						{words.on_pace}
						<Money amount={row.projectedMinor} currency={row.currency} />
						{words.projected}
					</span>
					<button
						class="icon-button"
						type="button"
						aria-label="{ui.copy.actions.edit} {row.name}"
						aria-expanded={editingId === row.categoryId}
						onclick={() => (editingId = editingId === row.categoryId ? null : row.categoryId)}
					>
						<Icon name="edit" size="1em" />
					</button>
				</div>
				{#if editingId === row.categoryId}
					<div class="edit">
						<form
							class="inline"
							method="POST"
							action="?/set"
							use:enhance={submitter(
								() => {
									editingId = null;
									notify(words.saved);
								},
								(next) => (rowErrors = { ...rowErrors, [row.categoryId]: next })
							)}
						>
							<input type="hidden" name="categoryId" value={row.categoryId} />
							<Field
								label={words.limit}
								for="{uid}-{row.categoryId}"
								error={errorText(ui.copy, errors, 'limit')}
							>
								<input
									id="{uid}-{row.categoryId}"
									name="limit"
									inputmode="decimal"
									value={row.typed}
								/>
							</Field>
							<Button type="submit">{ui.copy.actions.save}</Button>
						</form>
						<form
							method="POST"
							action="?/remove"
							use:enhance={submitter(() => notify(words.removed))}
						>
							<input type="hidden" name="categoryId" value={row.categoryId} />
							<Button type="submit" variant="ghost"><Icon name="trash" />{words.remove}</Button>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState message={words.empty} />
{/if}

{#if data.free.length > 0}
	<Card title={words.add}>
		<form
			class="add"
			method="POST"
			action="?/set"
			use:enhance={submitter(
				() => {
					pick = '';
					limit = '';
					notify(words.saved);
				},
				(next) => (addErrors = next)
			)}
		>
			<Field
				label={words.pick_category}
				for="{uid}-pick"
				error={errorText(ui.copy, addErrors, 'categoryId')}
			>
				<select id="{uid}-pick" name="categoryId" bind:value={pick}>
					<option value="" disabled>—</option>
					{#each data.free as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</Field>
			<Field
				label="{words.limit} ({ui.baseCurrency})"
				for="{uid}-limit"
				error={errorText(ui.copy, addErrors, 'limit')}
			>
				<input
					id="{uid}-limit"
					name="limit"
					inputmode="decimal"
					placeholder="0"
					bind:value={limit}
				/>
			</Field>
			<Button type="submit"><Icon name="plus" />{words.add}</Button>
		</form>
	</Card>
{/if}

<style>
	.overall {
		display: grid;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-xl);
	}
	.overall-text {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--tr-space-sm);
	}
	.label {
		flex-basis: 100%;
		color: var(--tr-color-text-muted);
	}
	.of {
		color: var(--tr-color-text-muted);
	}
	.budgets {
		display: grid;
		gap: var(--tr-space-md);
		margin: 0 0 var(--tr-space-xl);
		padding: 0;
		list-style: none;
	}
	@media (min-width: 900px) {
		.budgets {
			grid-template-columns: 1fr 1fr;
		}
	}
	.budget {
		display: grid;
		gap: var(--tr-space-sm);
		padding: var(--tr-space-md) var(--tr-space-lg);
		background: var(--tr-color-surface);
		border-inline-start: var(--tr-accent-border-width) solid var(--chip);
	}
	.budget[data-state='over'] {
		box-shadow: inset 0 0 0 2px var(--tr-color-danger);
	}
	.head,
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--tr-space-xs) var(--tr-space-md);
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-sm);
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		font-weight: var(--tr-weight-heading);
		text-transform: var(--tr-heading-case);
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		background: var(--chip);
		transform: skewX(var(--tr-skew));
	}
	.figures {
		display: inline-flex;
		align-items: baseline;
		gap: var(--tr-space-xs);
	}
	.foot {
		align-items: center;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	.left.over {
		color: var(--tr-color-danger);
		font-weight: var(--tr-weight-bold);
	}
	.pace {
		flex: 1;
		text-align: end;
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
	.icon-button:hover,
	.icon-button[aria-expanded='true'] {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.edit {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: var(--tr-space-sm);
		padding-block-start: var(--tr-space-sm);
		border-top: var(--tr-border-width) solid var(--tr-color-border);
	}
	.inline {
		display: flex;
		align-items: end;
		gap: var(--tr-space-sm);
	}
	.add {
		display: grid;
		gap: var(--tr-space-md);
		align-items: end;
	}
	@media (min-width: 720px) {
		.add {
			grid-template-columns: 1fr 1fr auto;
		}
	}
</style>
