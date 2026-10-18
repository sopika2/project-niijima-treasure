<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		closeLabel: string;
		onclose: () => void;
		children: Snippet;
	}

	let { open, title, closeLabel, onclose, children }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<!-- A bottom sheet on phones, a centered panel on wide screens. Esc and the backdrop close it. -->
<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={title}
	{onclose}
	onclick={(event) => {
		if (event.target === dialog) onclose();
	}}
>
	<div class="panel">
		<header>
			<h2>{title}</h2>
			<button type="button" class="close" onclick={onclose} aria-label={closeLabel}>
				<Icon name="close" />
			</button>
		</header>
		{#if open}{@render children()}{/if}
	</div>
</dialog>

<style>
	.sheet {
		width: 100%;
		max-width: 100%;
		max-height: 100dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--tr-color-text);
	}
	.sheet::backdrop {
		background: var(--tr-color-overlay);
	}
	.sheet[open] .panel {
		animation: rise var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	.panel {
		display: grid;
		gap: var(--tr-space-md);
		max-height: 92dvh;
		overflow-y: auto;
		padding: var(--tr-space-lg) var(--tr-space-md)
			calc(var(--tr-space-lg) + env(safe-area-inset-bottom));
		background: var(--tr-color-surface);
		border-top: var(--tr-accent-border-width) solid var(--tr-color-accent);
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--tr-space-md);
	}
	h2 {
		margin: 0;
		font-size: var(--tr-text-lg);
	}
	.close {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 0;
		border-radius: var(--tr-radius-md);
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text);
		cursor: pointer;
	}

	@media (min-width: 700px) {
		.sheet {
			width: min(32rem, calc(100% - 2rem));
			margin: auto;
		}
		.panel {
			padding: var(--tr-space-lg);
			border-top: 0;
			border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
			box-shadow: var(--tr-shadow-raised);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1.5rem);
		}
	}
</style>
