<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import CommandMenu from './CommandMenu.svelte';
	import Icon from './Icon.svelte';
	import Title from './Title.svelte';
	import type { NavItem } from './types.ts';

	interface Props {
		appName: string;
		logo?: string | null;
		nav: readonly NavItem[];
		/** Label of the phone menu button that holds the items not on the bottom bar. */
		moreLabel?: string;
		/** The main action (Add), shown in the sidebar on wide screens and as a floating button on phones. */
		action?: { label: string; onclick: () => void };
		/** Shown above the page, e.g. problems with style.yml or backups. */
		banner?: Snippet;
		/** The corner plate of the command menu. */
		plate?: { title: string; hint: string };
		/** The money counter at the bottom of the menu. */
		wallet?: { label: string; text: string } | null;
		closeLabel?: string;
		children: Snippet;
	}

	let {
		appName,
		logo = null,
		nav,
		moreLabel = 'Menu',
		action,
		banner,
		plate,
		wallet = null,
		closeLabel = 'Close',
		children
	}: Props = $props();

	let more = $state(false);
	let overlay = $state<HTMLElement | null>(null);
	const bar = $derived(nav.filter((item) => item.mobile !== false));
	const extra = $derived(nav.filter((item) => item.mobile === false));
	const extraActive = $derived(extra.some((item) => item.active));

	async function openMenu() {
		more = true;
		await tick();
		overlay?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus();
	}
	function key(event: KeyboardEvent) {
		if (more && event.key === 'Escape') more = false;
	}
</script>

<svelte:window onkeydown={key} />

{#snippet brand()}
	<a class="brand" href="/">
		{#if logo}<img src={logo} alt={appName} />{:else}<Title
				text={appName}
				level={2}
				size="md"
			/>{/if}
	</a>
{/snippet}

<div class="shell">
	<nav class="persona" aria-label="Main">
		<CommandMenu items={nav} variant="rail" {plate} {wallet} top={brand}>
			{#snippet extra()}
				{#if action}
					<button type="button" class="action action-rail" onclick={action.onclick}>
						<span class="action-inner"><Icon name="plus" />{action.label}</span>
					</button>
				{/if}
			{/snippet}
		</CommandMenu>
	</nav>

	<nav class="side" aria-label="Main">
		{@render brand()}
		{#if action}
			<button type="button" class="action action-wide" onclick={action.onclick}>
				<span class="action-inner"><Icon name="plus" />{action.label}</span>
			</button>
		{/if}
		<ul class="menu">
			{#each nav as item (item.href)}
				<li>
					<a href={item.href} aria-current={item.active ? 'page' : undefined}>
						<span class="item-inner">
							<Icon name={item.icon} size="1.15em" />
							<span>{item.label}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<nav class="bar" aria-label="Main">
		<ul>
			{#each bar as item (item.href)}
				<li>
					<a href={item.href} aria-current={item.active ? 'page' : undefined}>
						<Icon name={item.icon} size="1.35em" />
						<span class="bar-label">{item.label}</span>
					</a>
				</li>
			{/each}
			{#if extra.length > 0}
				<li>
					<button
						type="button"
						class:current={extraActive}
						aria-expanded={more}
						aria-controls="command-menu"
						onclick={openMenu}
					>
						<Icon name="menu" size="1.35em" />
						<span class="bar-label">{moreLabel}</span>
					</button>
				</li>
			{/if}
		</ul>
	</nav>

	{#if more}
		<div
			class="overlay"
			id="command-menu"
			role="dialog"
			aria-modal="true"
			aria-label={moreLabel}
			bind:this={overlay}
		>
			<CommandMenu items={nav} variant="full" {plate} {wallet} onpick={() => (more = false)} />
			<button type="button" class="close" onclick={() => (more = false)}>
				<span class="close-inner"><Icon name="close" />{closeLabel}</span>
			</button>
		</div>
	{/if}

	{#if action}
		<button
			type="button"
			class="action action-float"
			onclick={action.onclick}
			aria-label={action.label}
		>
			<span class="action-inner"><Icon name="plus" size="1.6em" /></span>
		</button>
	{/if}

	<main class="content">
		{#if banner}<div class="banner">{@render banner()}</div>{/if}
		{@render children()}
	</main>
</div>

<style>
	.shell {
		--bar-size: 4rem;
		min-height: 100dvh;
	}
	.content {
		view-transition-name: page;
		width: 100%;
		max-width: var(--tr-max-width);
		margin-inline: auto;
		padding: var(--tr-space-lg) var(--tr-space-md) calc(var(--bar-size) + 6rem);
	}
	.banner {
		display: grid;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-lg);
	}

	/* ── Wide screens: the red slab ───────────────────────────────────────── */
	.side {
		display: none;
	}
	.brand {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	/* Red letters would vanish on the red sidebar, so they turn black there. */
	:global([data-sidebar='accent']) .brand :global(.chip[data-variant='accent']) {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	.brand img {
		max-height: 2.75rem;
		max-width: 100%;
	}
	.menu {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.menu a {
		position: relative;
		isolation: isolate;
		display: block;
		padding: var(--tr-space-sm) var(--tr-space-md);
		color: inherit;
		text-decoration: none;
		font-family: var(--tr-font-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-lg);
		line-height: 1.1;
		transition: transform var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.item-inner {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-sm);
	}
	/* The selected item flips to a slanted block with a hard offset outline. */
	.menu a::before {
		content: '';
		position: absolute;
		inset: 2px -4px;
		z-index: -1;
		background: var(--tr-color-background);
		box-shadow: 5px 5px 0 var(--tr-color-paper);
		transform: skewX(var(--tr-skew)) scaleX(0);
		transform-origin: left center;
		transition: transform var(--tr-duration-slow) var(--tr-ease-emphasized);
	}
	.menu a:hover {
		transform: translateX(4px);
	}
	.menu a[aria-current='page'] {
		color: var(--tr-color-text);
		transform: translateX(8px);
	}
	.menu a[aria-current='page']::before {
		transform: skewX(var(--tr-skew)) scaleX(1);
	}

	/* ── Phones: the bottom bar ───────────────────────────────────────────── */
	.bar {
		position: fixed;
		z-index: 10;
		inset: auto 0 0 0;
		height: calc(var(--bar-size) + env(safe-area-inset-bottom));
		padding: 0 var(--tr-space-xs) env(safe-area-inset-bottom);
		background: var(--tr-color-background);
		border-top: var(--tr-accent-border-width) solid var(--tr-color-accent);
	}
	.bar ul {
		display: flex;
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.bar li {
		flex: 1 1 0;
		min-width: 0;
	}
	.bar a,
	.bar button {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--tr-color-text-muted);
		font: inherit;
		font-family: var(--tr-font-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-decoration: none;
		cursor: pointer;
	}
	.bar a::before,
	.bar button::before {
		content: '';
		position: absolute;
		inset: 6px 3px;
		z-index: -1;
		background: var(--tr-color-accent);
		transform: skewX(var(--tr-skew)) scaleY(0);
		transform-origin: bottom;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	.bar a[aria-current='page'],
	.bar button.current {
		color: var(--tr-color-accent-text);
	}
	.bar a[aria-current='page']::before,
	.bar button.current::before {
		transform: skewX(var(--tr-skew)) scaleY(1);
	}
	.bar-label {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Phones: the full-screen command menu ─────────────────────────────── */
	.overlay {
		position: fixed;
		z-index: 30;
		inset: 0;
		display: grid;
		overflow-y: auto;
		animation: swipe var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	.close {
		position: absolute;
		right: var(--tr-space-md);
		bottom: calc(var(--tr-space-lg) + env(safe-area-inset-bottom));
		min-height: 2.75rem;
		padding: 0 var(--tr-space-md);
		border: 2px solid var(--tr-color-paper);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		font: inherit;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-md);
		text-transform: var(--tr-heading-case);
		cursor: pointer;
		transform: rotate(-4deg);
		box-shadow: 4px 4px 0 var(--tr-color-accent);
	}
	.close-inner {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-xs);
	}

	/* ── The Add button ───────────────────────────────────────────────────── */
	.action {
		border: 0;
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
		font: inherit;
		font-family: var(--tr-font-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		cursor: pointer;
		transform: skewX(var(--tr-skew));
		box-shadow: 5px 5px 0 var(--tr-color-paper);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-standard),
			box-shadow var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.action:hover {
		transform: skewX(var(--tr-skew)) translate(-2px, -2px);
		box-shadow: 7px 7px 0 var(--tr-color-paper);
	}
	.action:active {
		transform: skewX(var(--tr-skew)) translate(3px, 3px);
		box-shadow: 2px 2px 0 var(--tr-color-paper);
	}
	.action-inner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--tr-space-sm);
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	.action-wide {
		display: none;
	}
	.persona {
		display: none;
	}
	.action-rail {
		min-height: 2.75rem;
		padding: 0 var(--tr-space-lg);
		font-size: var(--tr-text-lg);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		box-shadow: 5px 5px 0 var(--tr-color-accent);
	}
	.action-rail:hover {
		box-shadow: 7px 7px 0 var(--tr-color-accent);
	}
	.action-float {
		position: fixed;
		z-index: 11;
		right: var(--tr-space-md);
		bottom: calc(var(--bar-size) + var(--tr-space-md) + env(safe-area-inset-bottom));
		display: grid;
		place-items: center;
		width: 3.75rem;
		height: 3.75rem;
	}

	@media (min-width: 900px) {
		.shell {
			display: grid;
			grid-template-columns: 16rem minmax(0, 1fr);
		}
		.bar,
		.action-float,
		.overlay {
			display: none;
		}
		.content {
			padding: var(--tr-space-xl) var(--tr-space-xl);
		}
		.side {
			position: sticky;
			top: 0;
			display: flex;
			flex-direction: column;
			gap: var(--tr-space-lg);
			height: 100dvh;
			overflow-y: auto;
			padding: var(--tr-space-xl) var(--tr-space-lg) var(--tr-space-xl) var(--tr-space-md);
			background: var(--tr-color-surface);
			color: var(--tr-color-text);
		}
		/* layout.sidebar: accent turns the sidebar into a red slab with a jagged edge. */
		:global([data-sidebar='accent']) .side {
			background: var(--tr-color-accent);
			color: var(--tr-color-accent-text);
			clip-path: polygon(0 0, 100% 0, 92% 38%, 100% 41%, 88% 100%, 0 100%);
		}
		:global([data-sidebar='accent']) .action-wide {
			background: var(--tr-color-background);
			color: var(--tr-color-text);
		}
		/* layout.sidebar: persona swaps the plain list for the command menu. */
		:global([data-sidebar='persona']) .shell {
			grid-template-columns: 19rem minmax(0, 1fr);
		}
		:global([data-sidebar='persona']) .side {
			display: none;
		}
		:global([data-sidebar='persona']) .persona {
			position: sticky;
			top: 0;
			display: block;
			height: 100dvh;
			overflow: clip;
		}
		.action-wide {
			display: block;
			align-self: start;
			min-height: 3rem;
			padding: 0 var(--tr-space-lg);
			font-size: var(--tr-text-lg);
		}
	}

	@keyframes swipe {
		from {
			clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
		}
		to {
			clip-path: polygon(0 0, 130% 0, 100% 100%, 0 100%);
		}
	}
</style>
