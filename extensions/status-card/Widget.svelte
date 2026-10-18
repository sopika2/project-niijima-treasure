<script lang="ts">
	import type { WidgetProps } from '@treasure/stats-sdk';
	import { Badge, Card, useUi } from '@treasure/ui';
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

	const rows = $derived([
		{
			label: ui.copy.labels.backup,
			tone: backup.tone,
			word: backup.word,
			hint: when(data.snapshot.lastSavedAt)
		},
		{
			label: ui.copy.labels.drive,
			tone: data.driveReachable ? ('success' as const) : ('danger' as const),
			word: data.driveReachable ? ui.copy.status.drive_ok : ui.copy.status.drive_missing,
			hint: null
		},
		{
			label: ui.copy.labels.rates,
			tone: data.ratesAsOf ? ('success' as const) : ('muted' as const),
			word: data.ratesAsOf ? ui.copy.status.rates_ok : ui.copy.status.rates_never,
			hint: when(data.ratesAsOf)
		}
	]);
</script>

<Card title={ui.copy.status.title}>
	<dl>
		{#each rows as row (row.label)}
			<div class="row">
				<dt>{row.label}</dt>
				<dd>
					<Badge tone={row.tone}>{row.word}</Badge>
					{#if settings.show_details && row.hint}<span class="hint">{row.hint}</span>{/if}
				</dd>
			</div>
		{/each}
	</dl>
</Card>

<style>
	dl {
		display: grid;
		gap: var(--tr-space-sm);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--tr-space-sm);
		min-height: 2.25rem;
		border-bottom: var(--tr-border-width) solid var(--tr-color-border);
	}
	dt {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	dd {
		display: grid;
		justify-items: end;
		margin: 0;
	}
	.hint {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
</style>
