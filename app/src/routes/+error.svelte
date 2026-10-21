<script lang="ts">
	/**
	 * Every error, drawn like the landing page's 404 Palace: the status in cut-out tiles, a
	 * ransom-note title, the address that was asked for on a Target plate, and the way back.
	 */
	import { page } from '$app/state';
	import type { Style } from '@treasure/style';
	import { Title } from '@treasure/ui';

	type Palace = Style['copy']['palace'];

	// The root layout's data is normally there; if it failed itself, plain words stand in.
	const fallback: Palace = {
		target: 'Target',
		missing_title: 'Page not found',
		missing_body: 'This page does not exist.',
		error_title: 'Something went wrong',
		error_body: 'Try again in a moment.',
		back: 'Back to the dashboard'
	};
	const words = $derived(
		(page.data.ui as { copy?: { palace?: Palace } } | undefined)?.copy?.palace ?? fallback
	);
	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} · {missing ? words.missing_title : words.error_title}</title>
</svelte:head>

<main class="palace">
	<div class="bg" aria-hidden="true">
		<span class="band"></span>
		<span class="band thin"></span>
		<span class="ghost">{page.status}</span>
	</div>

	<div class="body">
		<div class="code" aria-hidden="true">
			<Title text={String(page.status)} size="xl" level={2} />
		</div>
		<Title text={missing ? words.missing_title : words.error_title} size="lg" />
		<p class="target"><span>{words.target}</span><code>{page.url.pathname}</code></p>
		<p class="speech">{missing ? words.missing_body : words.error_body}</p>
		<a class="back" href="/">{words.back}<i aria-hidden="true"></i></a>
	</div>
</main>

<style>
	.palace {
		position: relative;
		isolation: isolate;
		display: grid;
		align-items: center;
		min-height: 100dvh;
		overflow: hidden;
		padding: var(--tr-space-lg) clamp(var(--tr-space-md), 6vw, 6rem);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	.bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background:
			linear-gradient(118deg, var(--tr-color-ink) 0 38%, transparent 38%),
			radial-gradient(color-mix(in srgb, var(--tr-color-ink) 34%, transparent) 30%, transparent 34%)
				0 0 / 13px 13px,
			color-mix(in srgb, var(--tr-color-accent) 30%, var(--tr-color-ink));
	}
	.band {
		position: absolute;
		left: -15%;
		width: 130%;
		top: 58%;
		height: 22%;
		background: var(--tr-color-accent);
		transform: rotate(-11deg);
		clip-path: polygon(0 18%, 58% 0, 100% 10%, 100% 84%, 41% 100%, 0 90%);
	}
	.band.thin {
		top: 54%;
		height: 1.4%;
		background: var(--tr-color-paper);
		clip-path: none;
		transform: rotate(-15deg);
	}
	.ghost {
		position: absolute;
		right: -3%;
		top: -12%;
		font: 400 clamp(220px, 46vw, 720px) / 0.8 var(--tr-font-heading);
		color: transparent;
		-webkit-text-stroke: 3px color-mix(in srgb, var(--tr-color-paper) 22%, transparent);
		opacity: 0.6;
	}
	.body {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-lg);
		width: min(100%, 60rem);
	}
	.code {
		transform: rotate(-6deg);
		transform-origin: 0 100%;
	}
	.target {
		display: inline-flex;
		margin: 0;
		box-shadow: 6px 6px 0 var(--tr-color-ink);
		transform: rotate(-2deg);
	}
	.target span {
		padding: 6px 12px 5px;
		background: var(--tr-color-sae);
		color: var(--tr-color-ink);
		font: 800 13px/1.4 var(--tr-font-body);
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.target code {
		padding: 6px 14px 5px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font: 700 clamp(14px, 1.6vw, 19px) / 1.3 var(--tr-font-body);
		letter-spacing: 0.04em;
		word-break: break-all;
	}
	.speech {
		max-width: 34em;
		margin: 0;
		padding: 14px 20px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font: 700 clamp(15px, 1.7vw, 20px) / 1.4 var(--tr-font-body);
		white-space: pre-line;
		clip-path: polygon(0 6%, 100% 0, 98% 100%, 2% 92%);
	}
	.back {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 13px 28px 11px 22px;
		color: var(--tr-color-ink);
		font: 400 22px/1 var(--tr-font-heading);
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
		transform: rotate(-3deg);
		transition: transform var(--tr-duration-fast) var(--tr-ease-emphasized);
	}
	.back::before,
	.back::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(3% 6%, 100% 0, 96% 100%, 0 90%);
	}
	.back::before {
		z-index: -1;
		background: var(--tr-color-paper);
	}
	.back::after {
		z-index: -2;
		background: var(--tr-color-accent);
		transform: translate(6px, 6px);
	}
	.back:hover,
	.back:focus-visible {
		color: var(--tr-color-paper);
		transform: rotate(-3deg) scale(1.07);
	}
	.back:hover::before,
	.back:focus-visible::before {
		background: var(--tr-color-ink);
	}
	.back i {
		width: 0.6em;
		height: 0.7em;
		background: currentColor;
		clip-path: polygon(0 0, 100% 50%, 0 100%, 22% 50%);
	}
</style>
