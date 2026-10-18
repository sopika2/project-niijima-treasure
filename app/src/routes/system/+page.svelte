<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, Notice, PageHeader, Stat, useUi } from '@treasure/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.system);
	let busy = $state(false);

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

<PageHeader title={ui.copy.nav.system} subtitle="Niijima Treasury {data.version}" />

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
				<Badge tone={data.access === 'cloudflare' ? 'success' : 'warning'}>
					{data.access === 'cloudflare' ? words.access_on : words.access_off}
				</Badge>
			</Stat>
			<Stat label={words.extensions}>{data.config.extensions.join(', ') || '—'}</Stat>
		</dl>
		<p class="path"><code>{data.config.path}</code></p>
	</Card>
</div>

<style>
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
