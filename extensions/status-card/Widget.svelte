<script lang="ts">
	import type { WidgetProps } from '@treasure/stats-sdk';
	import { Badge, Card, Money, Stat, useUi } from '@treasure/ui';
	import type { StatusCardData, StatusCardSettings } from './query.ts';

	let { data, settings }: WidgetProps<StatusCardData, StatusCardSettings> = $props();
	const ui = useUi();

	const when = (iso: string | null) =>
		iso
			? new Intl.DateTimeFormat(ui.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(iso)
				)
			: null;

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

<Card title={ui.copy.terms.total} accent wide>
	<div class="total">
		<Money amount={data.total.amount} currency={data.total.currency} size="xl" />
		<span class="count">
			{data.accountCount}
			{data.accountCount === 1 ? ui.copy.terms.account : ui.copy.terms.accounts}
		</span>
	</div>

	{#if data.missingRates.length > 0}
		<p class="note">{ui.copy.status.missing_rates} {data.missingRates.join(', ')}</p>
	{/if}

	{#if settings.show_details}
		<dl class="details">
			<Stat label={ui.copy.labels.backup} hint={when(data.snapshot.lastSavedAt) ?? undefined}>
				<Badge tone={backup.tone}>{backup.word}</Badge>
			</Stat>
			<Stat label={ui.copy.labels.drive}>
				<Badge tone={data.driveReachable ? 'success' : 'danger'}>
					{data.driveReachable ? ui.copy.status.drive_ok : ui.copy.status.drive_missing}
				</Badge>
			</Stat>
			<Stat label={ui.copy.labels.rates} hint={when(data.ratesAsOf) ?? undefined}>
				<Badge tone={data.ratesAsOf ? 'success' : 'muted'}>
					{data.ratesAsOf ? ui.copy.status.rates_ok : ui.copy.status.rates_never}
				</Badge>
			</Stat>
		</dl>
	{/if}
</Card>

<style>
	.total {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--tr-space-sm) var(--tr-space-md);
	}
	.count {
		color: var(--tr-color-text-muted);
	}
	.note {
		margin: 0;
		color: var(--tr-color-warning);
		font-size: var(--tr-text-sm);
	}
	.details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--tr-space-md);
		padding-top: var(--tr-space-md);
		border-top: var(--tr-border-width) solid var(--tr-color-border);
	}
</style>
