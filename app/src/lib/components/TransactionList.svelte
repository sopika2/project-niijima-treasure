<script lang="ts">
	import { Icon, Money, useUi } from '@treasure/ui';
	import type { TransactionRow } from '#lib/types.ts';

	interface Props {
		rows: readonly TransactionRow[];
		/** Show a heading for each day. */
		grouped?: boolean;
	}

	let { rows, grouped = true }: Props = $props();
	const ui = useUi();

	const dayFormat = $derived(
		new Intl.DateTimeFormat(ui.locale, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		})
	);
	const day = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

	const groups = $derived.by(() => {
		const list: Array<{ date: string; rows: TransactionRow[] }> = [];
		for (const row of rows) {
			const last = list.at(-1);
			if (grouped && last?.date === row.date) last.rows.push(row);
			else list.push({ date: row.date, rows: [row] });
		}
		return list;
	});

	const title = (row: TransactionRow) =>
		row.note ||
		row.category?.name ||
		(row.kind === 'transfer'
			? ui.copy.terms.transfer
			: row.kind === 'income'
				? ui.copy.terms.income
				: ui.copy.transactions.uncategorized);
</script>

<div class="list">
	{#each groups as group (group.date + group.rows[0]?.id)}
		<section>
			{#if grouped}<h3 class="day">{day(group.date)}</h3>{/if}
			<ul>
				{#each group.rows as row (row.id)}
					<li>
						<a href="/transactions/{row.id}" class="row" data-kind={row.kind}>
							<span
								class="mark"
								style={row.category ? `--mark: var(--tr-chart-${row.category.color})` : undefined}
							>
								<Icon
									name={row.kind === 'transfer' ? 'transfer' : row.kind === 'income' ? 'in' : 'out'}
									size="1.1em"
								/>
							</span>
							<span class="text">
								<span class="title">{title(row)}</span>
								<span class="meta">
									{#if row.kind === 'transfer'}
										{row.account} → {row.toAccount}
									{:else}
										{#if row.note && row.category}{`${row.category.name} · `}{/if}{row.account}
									{/if}
									{#if !grouped}{` · ${day(row.date)}`}{/if}
								</span>
							</span>
							<span class="amount">
								<Money
									amount={row.kind === 'transfer' ? Math.abs(row.amount) : row.amount}
									currency={row.currency}
									signed={row.kind !== 'transfer'}
									tone={row.kind === 'transfer' ? 'none' : 'auto'}
								/>
								{#if row.kind === 'transfer' && row.toCurrency && row.toCurrency !== row.currency && row.toAmount !== null}
									<span class="meta"
										><Money amount={row.toAmount} currency={row.toCurrency} size="sm" /></span
									>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.list {
		display: grid;
		gap: var(--tr-space-md);
	}
	section {
		display: grid;
		gap: var(--tr-space-xs);
	}
	.day {
		margin: 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
		letter-spacing: 0.08em;
	}
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li + li {
		border-top: var(--tr-border-width) solid var(--tr-color-border);
	}
	.row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--tr-space-md);
		padding: var(--tr-space-sm) var(--tr-space-xs);
		color: inherit;
		text-decoration: none;
		transition: background-color var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.row:hover {
		background: var(--tr-color-surface-raised);
	}
	.mark {
		--mark: var(--tr-color-text-muted);
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		/* the tile carries the category's colour, the arrow says which way the money went */
		color: var(--tr-color-expense);
		background: color-mix(in srgb, var(--mark) 22%, transparent);
		clip-path: polygon(12% 0, 100% 0, 88% 100%, 0 100%);
	}
	[data-kind='income'] .mark {
		color: var(--tr-color-income);
	}
	[data-kind='transfer'] .mark {
		--mark: var(--tr-color-secondary);
		color: var(--tr-color-secondary);
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.title,
	.meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-weight: var(--tr-weight-medium);
	}
	.meta {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
	.amount {
		display: grid;
		justify-items: end;
		font-weight: var(--tr-weight-bold);
	}
</style>
