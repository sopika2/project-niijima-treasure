<script lang="ts">
	interface Props {
		/** The message; set to a new value to show it again. Empty hides it. */
		message: string;
		/** Changes every time, so the same message can show twice in a row. */
		key?: number;
	}

	let { message, key = 0 }: Props = $props();
	let visible = $state(false);

	$effect(() => {
		void key;
		if (!message) return;
		visible = true;
		const timer = setTimeout(() => (visible = false), 2600);
		return () => clearTimeout(timer);
	});
</script>

<div class="toast" class:visible role="status" aria-live="polite">
	{#if message}<span>{message}</span>{/if}
</div>

<style>
	.toast {
		position: fixed;
		z-index: 50;
		left: 50%;
		bottom: calc(5.5rem + env(safe-area-inset-bottom));
		padding: var(--tr-space-sm) var(--tr-space-lg);
		background: var(--tr-color-text);
		color: var(--tr-color-background);
		font-weight: var(--tr-weight-bold);
		transform: translate(-50%, 1rem) skewX(var(--tr-skew));
		opacity: 0;
		pointer-events: none;
		transition:
			opacity var(--tr-duration-normal) var(--tr-ease-standard),
			transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	.toast span {
		display: inline-block;
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	.visible {
		opacity: 1;
		transform: translate(-50%, 0) skewX(var(--tr-skew));
	}
	@media (min-width: 900px) {
		.toast {
			bottom: var(--tr-space-xl);
		}
	}
</style>
