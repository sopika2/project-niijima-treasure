<script lang="ts">
	import { useUi } from './context.ts';

	interface Props {
		/** YYYY-MM-DD, or null for "no date". */
		date: string | null;
		/** Ink on paper (default) or accent. */
		tone?: 'paper' | 'accent' | 'muted';
	}

	let { date, tone = 'paper' }: Props = $props();
	const ui = useUi();

	const parts = $derived.by(() => {
		if (!date) return null;
		const at = new Date(`${date}T00:00:00Z`);
		return {
			day: at.getUTCDate(),
			month: new Intl.DateTimeFormat(ui.locale, { month: 'short', timeZone: 'UTC' })
				.format(at)
				.replace('.', ''),
			full: new Intl.DateTimeFormat(ui.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(at)
		};
	});
</script>

<span class="tag" data-tone={tone} title={parts?.full}>
	{#if parts}
		<span class="day">{parts.day}</span>
		<span class="month">{parts.month}</span>
	{:else}
		<span class="day">–</span>
	{/if}
</span>

<style>
	.tag {
		display: inline-grid;
		justify-items: center;
		align-content: center;
		min-width: 3.4rem;
		padding: var(--tr-space-xs) var(--tr-space-sm);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		transform: skewX(var(--tr-skew));
		line-height: 1;
	}
	.tag > * {
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	[data-tone='accent'] {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	[data-tone='muted'] {
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text-muted);
	}
	.day {
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-xl);
		font-weight: var(--tr-weight-heading);
	}
	.month {
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-bold);
		text-transform: uppercase;
	}
</style>
