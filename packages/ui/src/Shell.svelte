<script lang="ts">
	/**
	 * The frame around every page. With layout.navigation: command (the default) there is a slim
	 * top bar, and the Persona 5 command menu opens full screen from its Menu button or Esc.
	 * With navigation: sidebar, wide screens get a menu that is always shown at the side.
	 */
	import type { Snippet } from 'svelte';
	import CommandScreen from './CommandScreen.svelte';
	import Icon from './Icon.svelte';
	import Title from './Title.svelte';
	import type { CommandWords, MenuArt, NavItem } from './types.ts';

	interface Props {
		appName: string;
		logo?: string | null;
		nav: readonly NavItem[];
		/** The Menu button's label. */
		menuLabel?: string;
		words: CommandWords;
		/** The main action (Add). */
		action?: { label: string; onclick: () => void };
		/** Shown above the page, e.g. problems with style.yml or backups. */
		banner?: Snippet;
		/** The money counter on the command menu. */
		wallet?: { label: string; text: string } | null;
		art?: MenuArt | null;
		/** Whose books you're looking at (Makoto or Sae): in the top bar, the sidebar, or above the page on phones. */
		switcher?: Snippet;
		children: Snippet;
	}

	let {
		appName,
		logo = null,
		nav,
		menuLabel = 'Menu',
		words,
		action,
		banner,
		wallet = null,
		art = null,
		switcher,
		children
	}: Props = $props();

	let open = $state(false);
	let opener = $state<HTMLButtonElement | null>(null);

	function close() {
		open = false;
		opener?.focus();
	}

	/** Esc opens the menu, like Start in the game, unless you're typing or a sheet is open. */
	function key(event: KeyboardEvent) {
		if (event.key !== 'Escape' || open || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable]')) return;
		if (document.querySelector('dialog[open]')) return;
		event.preventDefault();
		open = true;
	}
	const current = $derived(nav.find((item) => item.active));

	/* The floating Add button steps aside while you scroll down a list, so it never sits on
	   the amount you're reading, and comes back as soon as you scroll up. */
	let tucked = $state(false);
	let lastY = 0;
	function scrolled() {
		const y = window.scrollY;
		if (Math.abs(y - lastY) < 8) return;
		tucked = y > lastY && y > 80;
		lastY = y;
	}
</script>

<svelte:window onkeydown={key} onscroll={scrolled} />

<div class="shell">
	<header class="top" inert={open}>
		<a class="brand" href="/" aria-label={appName}>
			{#if logo}<img src={logo} alt={appName} />{:else}<span class="wordmark" aria-hidden="true"
					>{appName}<small>新島姉妹</small></span
				>{/if}
		</a>
		{#if current}<span class="where" aria-hidden="true">{current.label}</span>{/if}
		<div class="top-actions">
			{#if switcher}<div class="switch switch-top">{@render switcher()}</div>{/if}
			{#if action}
				<button type="button" class="action action-top" onclick={action.onclick}>
					<span class="action-inner"><Icon name="plus" />{action.label}</span>
				</button>
			{/if}
			<button
				type="button"
				class="menu-button"
				aria-haspopup="dialog"
				aria-expanded={open}
				bind:this={opener}
				onclick={() => (open = true)}
			>
				<span class="menu-inner"><Icon name="menu" />{menuLabel}<kbd>Esc</kbd></span>
			</button>
		</div>
	</header>

	<nav class="side" aria-label="Main" inert={open}>
		<a class="side-brand" href="/">
			{#if logo}<img src={logo} alt={appName} />{:else}<Title
					text={appName}
					level={2}
					size="md"
				/>{/if}
		</a>
		{#if action}
			<button type="button" class="action action-side" onclick={action.onclick}>
				<span class="action-inner"><Icon name="plus" />{action.label}</span>
			</button>
		{/if}
		<ul class="menu">
			{#each nav as item (item.href)}
				<li>
					<a href={item.href} aria-current={item.active ? 'page' : undefined}>
						<span class="item-inner"
							><Icon name={item.icon} size="1.15em" /><span>{item.label}</span></span
						>
					</a>
				</li>
			{/each}
		</ul>
		{#if switcher}<div class="switch">{@render switcher()}</div>{/if}
	</nav>

	{#if action}
		<button
			type="button"
			class="action action-float"
			class:tucked
			onclick={action.onclick}
			aria-label={action.label}
			inert={open}
		>
			<span class="action-inner"><Icon name="plus" size="1.6em" /></span>
		</button>
	{/if}

	<main class="content" inert={open}>
		{#if switcher}<div class="switch switch-phone">{@render switcher()}</div>{/if}
		{#if banner}<div class="banner">{@render banner()}</div>{/if}
		{@render children()}
	</main>
</div>

{#if open}
	<CommandScreen items={nav} {words} {wallet} {art} onclose={close} />
{/if}

<style>
	.shell {
		min-height: 100dvh;
	}
	.content {
		view-transition-name: page;
		width: 100%;
		max-width: var(--tr-max-width);
		margin-inline: auto;
		padding: var(--tr-space-lg) var(--tr-space-md) 7rem;
	}
	.banner {
		display: grid;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-lg);
	}

	/* ── The top bar ──────────────────────────────────────────────────────── */
	.top {
		position: sticky;
		z-index: 20;
		top: 0;
		display: flex;
		align-items: center;
		gap: var(--tr-space-md);
		min-height: 3.75rem;
		padding: var(--tr-space-xs) var(--tr-space-md);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		border-bottom: var(--tr-accent-border-width) solid var(--tr-color-accent);
		/* Never wider than the screen, whatever the brand and labels add up to. */
		overflow-x: clip;
	}
	.brand {
		flex: none;
		color: inherit;
		font-size: 1.25rem;
		text-decoration: none;
	}
	.brand img {
		display: block;
		max-height: 2.5rem;
	}
	/* The landing page's wordmark: a tilted ink plate with a paper shadow. */
	.wordmark {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem 0.25rem;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		box-shadow: 4px 4px 0 var(--tr-color-paper);
		font-family: var(--tr-font-heading);
		font-size: 1.1rem;
		letter-spacing: 0.14em;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
		transform: rotate(-3deg);
	}
	.wordmark small {
		color: var(--tr-color-text-muted);
		font-family: var(--tr-font-body);
		font-size: 0.6rem;
		font-weight: var(--tr-weight-bold);
		letter-spacing: 0.2em;
	}
	.where {
		overflow: hidden;
		color: var(--tr-color-text-muted);
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.top-actions {
		display: flex;
		align-items: center;
		gap: var(--tr-space-md);
		margin-inline-start: auto;
	}
	/* The landing page's BACK [Esc] plate: paper on a red block, tilted the other way. */
	.menu-button {
		position: relative;
		isolation: isolate;
		min-height: 2.6rem;
		padding: 0 var(--tr-space-md);
		border: 0;
		background: none;
		color: var(--tr-color-ink);
		font: inherit;
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-lg);
		text-transform: uppercase;
		cursor: pointer;
		transform: rotate(3deg);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-emphasized),
			color var(--tr-duration-fast);
	}
	.menu-button::before,
	.menu-button::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(6% 0, 100% 8%, 96% 100%, 0 88%);
	}
	.menu-button::before {
		z-index: -1;
		background: var(--tr-color-paper);
	}
	.menu-button::after {
		z-index: -2;
		background: var(--tr-color-accent);
		transform: translate(-6px, 5px);
	}
	.menu-button:hover {
		color: var(--tr-color-paper);
		transform: rotate(3deg) scale(1.06);
	}
	.menu-button:hover::before {
		background: var(--tr-color-accent);
	}
	.menu-button:hover::after {
		background: var(--tr-color-paper);
	}
	.menu-inner {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-xs);
	}
	.menu-inner kbd {
		margin-inline-start: var(--tr-space-xs);
		padding: 0 0.3rem;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		font-family: var(--tr-font-body);
		font-size: 0.65rem;
		font-weight: var(--tr-weight-bold);
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
		box-shadow: 4px 4px 0 var(--tr-color-paper);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-standard),
			box-shadow var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.action:hover {
		transform: skewX(var(--tr-skew)) translate(-2px, -2px);
		box-shadow: 6px 6px 0 var(--tr-color-paper);
	}
	.action:active {
		transform: skewX(var(--tr-skew)) translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--tr-color-paper);
	}
	.action-inner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--tr-space-sm);
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	.action-top {
		display: none;
		min-height: 2.6rem;
		padding: 0 var(--tr-space-lg);
		font-size: var(--tr-text-lg);
	}
	.action-float {
		position: fixed;
		z-index: 11;
		right: var(--tr-space-md);
		bottom: calc(var(--tr-space-lg) + env(safe-area-inset-bottom));
		display: grid;
		place-items: center;
		width: 3.75rem;
		height: 3.75rem;
		transition: translate var(--tr-duration-normal) var(--tr-ease-standard);
	}
	.action-float.tucked {
		translate: calc(100% + var(--tr-space-md) + 12px) 0;
	}

	/* ── navigation: sidebar ──────────────────────────────────────────────── */
	.side {
		display: none;
	}
	.side-brand {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	.side-brand img {
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
	}
	.item-inner {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-sm);
	}
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
	.menu a[aria-current='page'] {
		color: var(--tr-color-text);
	}
	.menu a[aria-current='page']::before {
		transform: skewX(var(--tr-skew)) scaleX(1);
	}

	.switch {
		display: flex;
		flex: none;
		align-items: center;
	}
	.switch-phone {
		display: none;
		justify-content: flex-end;
		margin-block-end: var(--tr-space-md);
	}

	/* Phones: the page's own title says where you are, and the kanji would push Menu off. */
	@media (max-width: 599.98px) {
		.switch-top {
			display: none;
		}
		.switch-phone {
			display: flex;
		}
		.where,
		.wordmark small,
		.menu-inner kbd {
			display: none;
		}
		.wordmark {
			font-size: 0.95rem;
			letter-spacing: 0.1em;
		}
	}

	@media (min-width: 900px) {
		.action-top {
			display: block;
		}
		.action-float {
			display: none;
		}
		.content {
			padding: var(--tr-space-xl);
		}
		.top {
			padding-inline: var(--tr-space-xl);
		}
		.brand {
			font-size: 1.5rem;
		}

		:global([data-navigation='sidebar']) .shell {
			display: grid;
			grid-template-columns: 16rem minmax(0, 1fr);
		}
		:global([data-navigation='sidebar']) .top {
			display: none;
		}
		:global([data-navigation='sidebar']) .side {
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
		:global([data-navigation='sidebar'][data-sidebar='accent']) .side {
			background: var(--tr-color-accent);
			color: var(--tr-color-accent-text);
			clip-path: polygon(0 0, 100% 0, 92% 38%, 100% 41%, 88% 100%, 0 100%);
		}
		.action-side {
			align-self: start;
			min-height: 3rem;
			padding: 0 var(--tr-space-lg);
			font-size: var(--tr-text-lg);
			background: var(--tr-color-background);
			color: var(--tr-color-text);
		}
	}
</style>
