<script lang="ts" module>
	/** Simple line icons, drawn in the current text color. */
	const paths = {
		home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
		activity: 'M3 12h4l3-8 4 16 3-8h4',
		wallet:
			'M3 7.5A2.5 2.5 0 0 1 5.5 5H19v4M3 7.5V18a2 2 0 0 0 2 2h15V9H5.5A2.5 2.5 0 0 1 3 7.5ZM16 14.5h.01',
		gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4.6l-.4 2.3a7.5 7.5 0 0 0-2.2 1.3l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.2 1.3l.4 2.3h4.6l.4-2.3a7.5 7.5 0 0 0 2.2-1.3l2.4.9 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
		plus: 'M12 5v14M5 12h14',
		close: 'M6 6l12 12M18 6 6 18',
		left: 'M15 5l-7 7 7 7',
		right: 'M9 5l7 7-7 7',
		in: 'M12 19V5M6 13l6 6 6-6',
		out: 'M12 5v14M6 11l6-6 6 6',
		transfer: 'M4 8h14l-4-4M20 16H6l4 4',
		tag: 'M3 12V4h8l10 10-8 8L3 12Zm5-4.5h.01',
		edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
		archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
		search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 5 5',
		check: 'M5 12.5 10 17l9-10'
	} as const;

	export type IconName = keyof typeof paths | 'discord';
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: string;
		/** Read out by screen readers; leave empty for decorative icons. */
		label?: string;
	}

	let { name, size = '1.25em', label }: Props = $props();
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#if name === 'discord'}
		<path
			fill="currentColor"
			d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17a17.2 17.2 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17.1 17.1 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7ZM8.7 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z"
		/>
	{:else}
		<path
			d={paths[name]}
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: inline-block;
		vertical-align: -0.15em;
	}
</style>
