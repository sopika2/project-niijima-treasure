<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, Icon, Notice, PageHeader, Stat, useUi } from '@treasure/ui';
	import { errorText, submitter, type Errors } from '#lib/forms.ts';
	import { notify } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.system);
	let busy = $state(false);
	let fetching = $state(false);
	let rateProblem = $state<string | null>(null);
	let rateErrors = $state<Errors>({});
	let manualRate = $state('');
	const rateWords = $derived(ui.copy.rates);
	const rateText = (rate: string | null) =>
		rate === null
			? '—'
			: new Intl.NumberFormat(ui.locale, { maximumFractionDigits: 4 }).format(Number(rate));

	const when = (iso: string | null) =>
		iso
			? new Intl.DateTimeFormat(ui.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(iso)
				)
			: words.never;

	const size = (bytes: number) =>
		new Intl.NumberFormat(ui.locale, {
			style: 'unit',
			unit: 'kilobyte',
			maximumFractionDigits: 0
		}).format(bytes / 1024);

	const backup = $derived.by(() => {
		const status = ui.copy.status;
		switch (data.snapshot.state) {
			case 'saved':
				return { tone: 'success', word: status.snapshot_ok } as const;
			case 'pending':
				return { tone: 'warning', word: status.snapshot_pending } as const;
			case 'never':
				return { tone: 'muted', word: status.snapshot_never } as const;
			default:
				return { tone: 'danger', word: status.degraded } as const;
		}
	});
</script>

<PageHeader title={ui.copy.nav.system} subtitle="Niijima Treasury {data.version}">
	{#snippet actions()}
		{#if data.access === 'discord'}
			<form method="POST" action="/auth/logout">
				<Button type="submit" variant="ghost">{ui.copy.actions.sign_out}</Button>
			</form>
		{/if}
	{/snippet}
</PageHeader>

<div class="grid">
	<Card title={ui.copy.labels.backup} accent wide>
		{#snippet actions()}
			<form
				method="POST"
				action="?/snapshot"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<Button type="submit" {busy} disabled={data.snapshot.state === 'off'}>
					{ui.copy.actions.snapshot_now}
				</Button>
			</form>
		{/snippet}

		{#if form?.saved}
			<Notice tone="info" title={words.snapshot_taken} />
		{:else if form?.error}
			<Notice tone="danger" title={words.snapshot_failed}>{form.error}</Notice>
		{/if}

		<dl class="stats">
			<Stat label={words.state}><Badge tone={backup.tone}>{backup.word}</Badge></Stat>
			<Stat label={words.last_saved}>{when(data.snapshot.lastSavedAt)}</Stat>
			<Stat label={words.generation}>{data.snapshot.generation}</Stat>
			<Stat label={words.encryption}>
				<Badge tone={data.snapshot.encrypted ? 'success' : 'warning'}>
					{data.snapshot.encrypted ? words.encrypted : words.not_encrypted}
				</Badge>
			</Stat>
			<Stat label={ui.copy.labels.drive}>
				<Badge tone={data.drive.reachable && data.drive.writable ? 'success' : 'danger'}>
					{data.drive.reachable && data.drive.writable
						? ui.copy.status.drive_ok
						: ui.copy.status.drive_missing}
				</Badge>
			</Stat>
			<Stat label={words.nightly}>{data.nightly}</Stat>
		</dl>
		<p class="path"><code>{data.drive.path}</code></p>
		<!-- "off" and "blocked" are already explained in the banner at the top of every page. -->
		{#if data.snapshot.problem && data.snapshot.state !== 'off' && data.snapshot.state !== 'blocked'}
			<Notice tone="warning" title={ui.copy.status.degraded}>{data.snapshot.problem}</Notice>
		{/if}
	</Card>

	<Card title={rateWords.title} wide>
		{#snippet actions()}
			{#if data.rates.rows.length > 0 && data.rates.enabled}
				<form
					method="POST"
					action="?/refreshRates"
					use:enhance={() => {
						fetching = true;
						return async ({ result, update }) => {
							fetching = false;
							rateProblem = result.type === 'failure' ? String(result.data?.rates ?? '') : null;
							if (result.type === 'success') notify(rateWords.refreshed);
							await update({ reset: false });
						};
					}}
				>
					<Button type="submit" variant="secondary" busy={fetching}>
						<Icon name="repeat" />{rateWords.refresh}
					</Button>
				</form>
			{/if}
		{/snippet}
		{#if data.rates.rows.length === 0}
			<p class="path">{rateWords.none_needed}</p>
		{:else}
			<div class="table-wrap">
				<table class="rates">
					<thead>
						<tr>
							<th scope="col"></th>
							<th scope="col">{rateWords.value}</th>
							<th scope="col">{rateWords.buy}</th>
							<th scope="col">{rateWords.sell}</th>
							<th scope="col">{rateWords.as_of}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.rates.rows as row (row.currency)}
							<tr>
								<th scope="row">1 {row.currency}</th>
								<td class="num strong">{rateText(row.value)} {data.rates.base}</td>
								<td class="num">{rateText(row.buy)}</td>
								<td class="num">{rateText(row.sell)}</td>
								<td>
									{row.validFrom ? when(row.validFrom) : rateWords.never}
									{#if row.source}<Badge>{row.source.toUpperCase()}</Badge>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if rateProblem || data.rates.status.problem}
				<Notice tone="warning" title={ui.copy.verdicts.rates_failed}
					>{rateProblem || data.rates.status.problem}</Notice
				>
			{/if}
			<form
				class="manual"
				method="POST"
				action="?/manualRate"
				use:enhance={submitter(
					() => {
						manualRate = '';
						notify(rateWords.saved);
					},
					(next) => (rateErrors = next)
				)}
			>
				<span class="manual-title">{rateWords.manual}</span>
				<select name="currency" aria-label={ui.copy.form.currency}>
					{#each data.rates.rows as row (row.currency)}<option value={row.currency}
							>{row.currency}</option
						>{/each}
				</select>
				<input
					name="rate"
					inputmode="decimal"
					placeholder="395.12"
					aria-label={rateWords.value}
					bind:value={manualRate}
				/>
				<Button type="submit" variant="ghost">{ui.copy.actions.save}</Button>
				<p class="hint">
					{errorText(ui.copy, rateErrors, 'rate') ??
						errorText(ui.copy, rateErrors, 'currency') ??
						rateWords.manual_hint}
				</p>
			</form>
		{/if}
	</Card>

	<Card title={words.database}>
		<dl class="stats">
			<Stat label={words.size}>{size(data.database.bytes)}</Stat>
			<Stat label={words.instance}><code>{data.database.instance}</code></Stat>
		</dl>
		<p class="path"><code>{data.database.path}</code></p>
	</Card>

	<Card title={words.style}>
		<dl class="stats">
			<Stat label={words.name}>{data.style.name}</Stat>
			<Stat label={words.defaults_used}>{data.style.defaultsUsed}</Stat>
		</dl>
		<p class="path">{words.source}: <code>{data.style.source}</code></p>
	</Card>

	<Card title={words.config} wide>
		<dl class="stats">
			<Stat label={words.base_currency}>{data.config.baseCurrency}</Stat>
			<Stat label={words.timezone}>{data.config.timezone}</Stat>
			<Stat label={words.locale}>{data.config.locale}</Stat>
			<Stat label={words.access}>
				<Badge tone={data.access === 'discord' ? 'success' : 'warning'}>
					{data.access === 'discord' ? words.access_on : words.access_off}
				</Badge>
			</Stat>
			<Stat label={words.extensions}>{data.config.extensions.join(', ') || '—'}</Stat>
		</dl>
		<p class="path"><code>{data.config.path}</code></p>
	</Card>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
	}
	.rates {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--tr-text-sm);
	}
	.rates th,
	.rates td {
		padding: var(--tr-space-sm) var(--tr-space-md) var(--tr-space-sm) 0;
		border-bottom: var(--tr-border-width) solid var(--tr-color-border);
		text-align: start;
		white-space: nowrap;
	}
	.rates thead th {
		color: var(--tr-color-text-muted);
		font-weight: var(--tr-weight-medium);
	}
	.rates tbody th {
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		font-weight: var(--tr-weight-heading);
	}
	.num {
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
	}
	.strong {
		font-weight: var(--tr-weight-bold);
	}
	.manual {
		display: grid;
		grid-template-columns: 6rem 1fr auto;
		gap: var(--tr-space-sm);
		align-items: center;
		margin-block-start: var(--tr-space-md);
	}
	.manual-title {
		grid-column: 1 / -1;
		font-family: var(--tr-font-heading);
	}
	.hint {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
	.grid {
		display: grid;
		gap: var(--tr-space-lg);
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--tr-space-md);
	}
	.path {
		margin: 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
</style>
