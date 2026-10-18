<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { NavItem } from './types.ts';

	interface Props {
		appName: string;
		logo?: string | null;
		nav: readonly NavItem[];
		/** The main action (Add), shown in the sidebar on wide screens and as a floating button on phones. */
		action?: { label: string; onclick: () => void };
		/** Shown above the page, e.g. problems with style.yml or backups. */
		banner?: Snippet;
		children: Snippet;
	}

	let { appName, logo = null, nav, action, banner, children }: Props = $props();
</script>

<div class="shell">
	<nav class="nav" aria-label="Main">
		<a class="brand" href="/">
			{#if logo}<img src={logo} alt={appName} />{:else}<span>{appName}</span>{/if}
		</a>
		{#if action}
			<button type="button" class="action action-wide" onclick={action.onclick}>
				<span class="action-inner"><Icon name="plus" />{action.label}</span>
			</button>
		{/if}
		<ul>
			{#each nav as item (item.href)}
				<li>
					<a href={item.href} aria-current={item.active ? 'page' : undefined}>
						<Icon name={item.icon} size="1.35em" />
						<span class="label">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

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
		--nav-size: 4rem;
		min-height: 100dvh;
	}

	.content {
		width: 100%;
		max-width: var(--tr-max-width);
		margin-inline: auto;
		padding: var(--tr-space-lg) var(--tr-space-md) calc(var(--nav-size) + 6rem);
	}

	.banner {
		display: grid;
		gap: var(--tr-space-sm);
		margin-block-end: var(--tr-space-lg);
	}

	.nav {
		z-index: 10;
		display: flex;
		align-items: stretch;
		background: var(--tr-color-surface);
		border-color: var(--tr-color-border);
		border-style: solid;
		border-width: 0;
	}

	.brand {
		display: none;
		align-items: center;
		color: var(--tr-color-text);
		text-decoration: none;
		font-family: var(--tr-font-heading);
		font-weight: var(--tr-weight-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-lg);
		line-height: 1.05;
	}
	.brand span {
		text-shadow: 0.08em 0.08em 0 var(--tr-color-accent);
	}
	.brand img {
		max-height: 2.5rem;
		max-width: 100%;
	}

	ul {
		display: flex;
		flex: 1;
		gap: var(--tr-space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		flex: 1 1 0;
		min-width: 0;
	}

	a[href]:not(.brand) {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		height: 100%;
		min-height: 2.75rem;
		padding: 0 var(--tr-space-xs);
		color: var(--tr-color-text-muted);
		text-decoration: none;
		font-weight: var(--tr-weight-bold);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: 0.68rem;
		transition: color var(--tr-duration-normal) var(--tr-ease-standard);
	}
	.label {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a[href]:not(.brand):hover {
		color: var(--tr-color-text);
	}

	/* The active item sits on a slanted accent slab that sweeps in from the left. */
	a[href]:not(.brand)::before {
		content: '';
		position: absolute;
		inset: 6px 2px;
		z-index: -1;
		background: var(--tr-color-accent);
		transform: skewX(var(--tr-skew)) scaleX(0);
		transform-origin: left center;
		transition: transform var(--tr-duration-slow) var(--tr-ease-emphasized);
	}
	a[href][aria-current='page']:not(.brand),
	a[href][aria-current='page']:not(.brand):hover {
		color: var(--tr-color-accent-text);
	}
	a[href][aria-current='page']:not(.brand)::before {
		transform: skewX(var(--tr-skew)) scaleX(1);
	}

	/* The Add button: a slanted red block with a hard shadow. */
	.action {
		border: 0;
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
		font: inherit;
		font-weight: var(--tr-weight-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		cursor: pointer;
		transform: skewX(var(--tr-skew));
		box-shadow: 4px 4px 0 var(--tr-color-text);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-standard),
			box-shadow var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.action:hover {
		transform: skewX(var(--tr-skew)) translate(-1px, -1px);
		box-shadow: 6px 6px 0 var(--tr-color-text);
	}
	.action:active {
		transform: skewX(var(--tr-skew)) translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--tr-color-text);
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
	.action-float {
		position: fixed;
		z-index: 11;
		right: var(--tr-space-md);
		bottom: calc(var(--nav-size) + var(--tr-space-md) + env(safe-area-inset-bottom));
		display: grid;
		place-items: center;
		width: 3.75rem;
		height: 3.75rem;
	}

	/* Phones: nav_mobile in style.yml */
	:global([data-nav-mobile='bottom']) .nav {
		position: fixed;
		inset: auto 0 0 0;
		height: calc(var(--nav-size) + env(safe-area-inset-bottom));
		padding: 0 var(--tr-space-xs) env(safe-area-inset-bottom);
		border-top-width: var(--tr-border-width);
	}
	:global([data-nav-mobile='top']) .nav {
		position: sticky;
		top: 0;
		height: var(--nav-size);
		border-bottom-width: var(--tr-border-width);
	}
	:global([data-nav-mobile='top']) .action-float {
		bottom: calc(var(--tr-space-lg) + env(safe-area-inset-bottom));
	}

	/* Wide screens: nav_desktop in style.yml */
	@media (min-width: 900px) {
		.content {
			padding: var(--tr-space-xl) var(--tr-space-lg);
		}
		.brand {
			display: flex;
		}
		.action-float {
			display: none;
		}
		.action-wide {
			display: block;
			min-height: 3rem;
			padding: 0 var(--tr-space-lg);
			font-size: var(--tr-text-md);
		}
		a[href]:not(.brand) {
			flex-direction: row;
			justify-content: flex-start;
			gap: var(--tr-space-sm);
			padding: 0 var(--tr-space-md);
			font-size: var(--tr-text-md);
		}

		:global([data-nav-desktop='sidebar']) .shell {
			display: grid;
			grid-template-columns: 15rem minmax(0, 1fr);
		}
		:global([data-nav-desktop='sidebar']) .nav {
			position: sticky;
			inset: 0 auto auto 0;
			height: 100dvh;
			flex-direction: column;
			gap: var(--tr-space-lg);
			padding: var(--tr-space-xl) var(--tr-space-md);
			border-width: 0 var(--tr-border-width) 0 0;
		}
		:global([data-nav-desktop='sidebar']) ul {
			flex: 0;
			flex-direction: column;
		}

		:global([data-nav-desktop='top']) .nav {
			position: sticky;
			inset: 0 0 auto 0;
			height: var(--nav-size);
			align-items: center;
			gap: var(--tr-space-lg);
			padding: 0 var(--tr-space-lg);
			border-width: 0 0 var(--tr-border-width) 0;
		}
		:global([data-nav-desktop='top']) ul {
			flex: 0;
			height: 100%;
		}
		:global([data-nav-desktop='top']) li {
			flex: none;
		}
		:global([data-nav-desktop='top']) .action-wide {
			order: 3;
			margin-inline-start: auto;
			min-height: 2.5rem;
		}
	}
</style>
