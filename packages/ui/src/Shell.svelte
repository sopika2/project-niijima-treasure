<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { NavItem } from './types.ts';

	interface Props {
		appName: string;
		logo?: string | null;
		nav: readonly NavItem[];
		/** Shown above the page, e.g. problems with style.yml or backups. */
		banner?: Snippet;
		children: Snippet;
	}

	let { appName, logo = null, nav, banner, children }: Props = $props();
</script>

<div class="shell">
	<nav class="nav" aria-label="Main">
		<a class="brand" href="/">
			{#if logo}<img src={logo} alt={appName} />{:else}<span>{appName}</span>{/if}
		</a>
		<ul>
			{#each nav as item (item.href)}
				<li>
					<a href={item.href} aria-current={item.active ? 'page' : undefined}>
						<span class="label">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<main class="content">
		{#if banner}<div class="banner">{@render banner()}</div>{/if}
		{@render children()}
	</main>
</div>

<style>
	.shell {
		--nav-size: 3.75rem;
		min-height: 100dvh;
	}

	.content {
		width: 100%;
		max-width: var(--tr-max-width);
		margin-inline: auto;
		padding: var(--tr-space-lg) var(--tr-space-md) calc(var(--nav-size) + var(--tr-space-xl));
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
		text-decoration: none;
		font-family: var(--tr-font-heading);
		font-weight: var(--tr-weight-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-lg);
		line-height: 1.05;
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
		overflow-x: auto;
	}
	li {
		flex: 1 0 auto;
	}

	a[href]:not(.brand) {
		position: relative;
		isolation: isolate;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 2.75rem;
		padding: 0 var(--tr-space-md);
		color: var(--tr-color-text-muted);
		text-decoration: none;
		font-weight: var(--tr-weight-bold);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-sm);
		transition: color var(--tr-duration-normal) var(--tr-ease-standard);
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

	/* Phones: nav_mobile in style.yml */
	:global([data-nav-mobile='bottom']) .nav {
		position: fixed;
		inset: auto 0 0 0;
		height: var(--nav-size);
		padding-bottom: env(safe-area-inset-bottom);
		border-top-width: var(--tr-border-width);
	}
	:global([data-nav-mobile='top']) .nav {
		position: sticky;
		top: 0;
		height: var(--nav-size);
		border-bottom-width: var(--tr-border-width);
	}
	:global([data-nav-mobile='top']) .content {
		padding-bottom: var(--tr-space-xl);
	}

	/* Wide screens: nav_desktop in style.yml */
	@media (min-width: 900px) {
		.content {
			padding: var(--tr-space-xl) var(--tr-space-lg);
		}
		.brand {
			display: flex;
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
			gap: var(--tr-space-xl);
			padding: var(--tr-space-xl) var(--tr-space-md);
			border-width: 0 var(--tr-border-width) 0 0;
		}
		:global([data-nav-desktop='sidebar']) ul {
			flex: 0;
			flex-direction: column;
			overflow: visible;
		}
		:global([data-nav-desktop='sidebar']) a[href]:not(.brand) {
			justify-content: flex-start;
			font-size: var(--tr-text-md);
		}

		:global([data-nav-desktop='top']) .nav {
			position: sticky;
			inset: 0 0 auto 0;
			height: var(--nav-size);
			gap: var(--tr-space-xl);
			padding: 0 var(--tr-space-lg);
			border-width: 0 0 var(--tr-border-width) 0;
		}
		:global([data-nav-desktop='top']) ul {
			flex: 0;
		}
	}
</style>
