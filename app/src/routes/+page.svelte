<script lang="ts">
	import { widgets } from '#lib';
	import { Card, EmptyState, Notice, PageHeader, useUi } from '@treasure/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
</script>

<PageHeader title={ui.copy.nav.dashboard} subtitle={ui.copy.tagline} />

{#if !data.hasAccounts}
	<div class="empty">
		<EmptyState message={ui.copy.empty.dashboard} />
	</div>
{/if}

{#if data.widgets.length === 0}
	<EmptyState message={ui.copy.empty.widgets} />
{:else}
	<div class="grid">
		{#each data.widgets as widget (widget.id)}
			{@const Widget = widgets.get(widget.id)}
			{#if widget.error}
				<Card title={widget.name} wide={widget.wide}>
					<Notice tone="danger" title={widget.name}>{widget.error}</Notice>
				</Card>
			{:else if Widget}
				<Widget data={widget.data} settings={widget.settings} />
			{/if}
		{/each}
	</div>
{/if}

<style>
	.empty {
		margin-block-end: var(--tr-space-lg);
	}
	.grid {
		display: grid;
		gap: var(--tr-space-lg);
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: repeat(var(--tr-columns), minmax(0, 1fr));
		}
	}
</style>
