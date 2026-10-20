<script lang="ts">
	import { Icon, Title, useUi } from '@treasure/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
	const words = $derived(ui.copy.signin);

	const message = $derived.by(() => {
		switch (data.message) {
			case 'signed_out':
				return { tone: 'info', text: words.signed_out } as const;
			case 'expired':
				return { tone: 'warning', text: words.expired } as const;
			case 'failed':
				return { tone: 'warning', text: words.failed } as const;
			case 'refused':
				return { tone: 'danger', text: words.refused } as const;
			default:
				return null;
		}
	});

	const href = $derived(
		data.next === '/' ? '/auth/login' : `/auth/login?next=${encodeURIComponent(data.next)}`
	);

	let copied = $state(false);
	async function copyId() {
		if (!data.refusedId) return;
		try {
			await navigator.clipboard.writeText(data.refusedId);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>{words.button} · {ui.copy.app_name}</title>
</svelte:head>

<main class="signin">
	<div class="bg" aria-hidden="true">
		<span class="band"></span>
		<span class="band thin"></span>
		<span class="ghost">{words.title}</span>
	</div>

	<section class="panel" aria-label={words.title}>
		<p class="kicker">{words.kicker}<small>新島姉妹</small></p>
		<Title text={words.title} size="xl" />

		<div class="speech">
			<p class="subtitle">{words.subtitle}</p>

			{#if message}
				<div
					class="message"
					data-tone={message.tone}
					role={message.tone === 'danger' ? 'alert' : 'status'}
				>
					<p>{message.text}</p>
					{#if data.refusedId}
						<p class="help">{words.refused_help}</p>
						<button type="button" class="id" onclick={copyId}>
							<code>{data.refusedId}</code>
							<Icon name={copied ? 'check' : 'tag'} size="1em" />
						</button>
					{/if}
				</div>
			{/if}

			<a class="discord" {href}><Icon name="discord" size="1.4em" />{words.button}</a>
		</div>

		<p class="note">{words.note}</p>
	</section>
</main>

<style>
	/* The landing page's look: ink, a red band and a thin paper band slashed across. */
	.signin {
		position: relative;
		isolation: isolate;
		display: grid;
		align-items: center;
		min-height: 100dvh;
		overflow: hidden;
		padding: var(--tr-space-xl) clamp(var(--tr-space-md), 8vw, 8rem);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	.bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
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
		animation: sweep var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}
	.band.thin {
		top: 54%;
		height: 1.4%;
		background: var(--tr-color-paper);
		clip-path: none;
		transform: rotate(-15deg);
		animation-delay: 60ms;
	}
	.ghost {
		position: absolute;
		right: -3%;
		top: -8%;
		font: 400 clamp(160px, 30vw, 520px) / 0.8 var(--tr-font-heading);
		text-transform: uppercase;
		white-space: nowrap;
		color: transparent;
		-webkit-text-stroke: 3px color-mix(in srgb, var(--tr-color-paper) 18%, transparent);
	}

	.panel {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-lg);
		width: min(36rem, 100%);
		animation: enter var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}

	/* The landing page's wordmark plate. */
	.kicker {
		display: inline-flex;
		align-items: baseline;
		gap: 0.6rem;
		margin: 0;
		padding: 0.45rem 0.9rem 0.3rem;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		box-shadow: 5px 5px 0 var(--tr-color-paper);
		font: 400 1.3rem/1 var(--tr-font-heading);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		transform: rotate(-4deg);
	}
	.kicker small {
		color: var(--tr-color-text-muted);
		font: 700 0.7rem/1 var(--tr-font-body);
		letter-spacing: 0.2em;
	}

	/* A speech box: paper, tilted, an ink shadow and a cyan one. */
	.speech {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-md);
		width: 100%;
		padding: var(--tr-space-lg) var(--tr-space-xl) var(--tr-space-xl) var(--tr-space-lg);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		clip-path: polygon(0 4%, 60% 0, 100% 3%, 98% 100%, 2% 96%);
		filter: drop-shadow(-6px 6px 0 var(--tr-color-ink));
		transform: rotate(-2deg);
	}
	.subtitle {
		margin: 0;
		max-width: 30ch;
		font: 700 var(--tr-text-lg) / 1.35 var(--tr-font-body);
	}

	.message {
		display: grid;
		gap: var(--tr-space-sm);
		width: 100%;
		padding: var(--tr-space-sm) var(--tr-space-md);
		border: 2px solid var(--tr-color-ink);
		background: var(--tr-color-sae);
		color: var(--tr-color-ink);
		transform: rotate(-1deg);
	}
	.message[data-tone='danger'] {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		border-color: var(--tr-color-accent);
	}
	.message p {
		margin: 0;
	}
	.help {
		font-size: var(--tr-text-sm);
	}
	.id {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: var(--tr-space-sm);
		padding: var(--tr-space-xs) var(--tr-space-sm);
		border: 2px dashed currentColor;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	/* The landing page's button: paper front on a red block, flipping to ink on hover. */
	.discord {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		margin-block-start: var(--tr-space-sm);
		padding: 14px 30px 12px 24px;
		color: var(--tr-color-paper);
		font: 400 var(--tr-text-lg) / 1 var(--tr-font-heading);
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
		transform: rotate(-3deg);
		transition: transform var(--tr-duration-fast) var(--tr-ease-emphasized);
	}
	.discord::before,
	.discord::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(3% 6%, 100% 0, 96% 100%, 0 90%);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-emphasized),
			background-color var(--tr-duration-fast);
	}
	.discord::before {
		z-index: -1;
		background: var(--tr-color-ink);
	}
	.discord::after {
		z-index: -2;
		background: var(--tr-color-accent);
		transform: translate(7px, 7px);
	}
	.discord:hover,
	.discord:focus-visible {
		color: var(--tr-color-ink);
		transform: rotate(-3deg) scale(1.05);
	}
	.discord:hover::before,
	.discord:focus-visible::before {
		background: var(--tr-color-accent);
	}
	.discord:hover::after,
	.discord:focus-visible::after {
		background: var(--tr-color-ink);
		transform: translate(10px, 10px);
	}

	.note {
		margin: 0;
		padding: 5px 9px 4px;
		background: var(--tr-color-ink);
		color: var(--tr-color-text-muted);
		font: 600 var(--tr-text-sm) / 1.35 var(--tr-font-body);
		letter-spacing: 0.04em;
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translateX(-2rem) rotate(2deg);
		}
	}
	@keyframes sweep {
		from {
			translate: -110% 0;
		}
	}

	@media (max-width: 700px) {
		.signin {
			align-items: end;
			padding: var(--tr-space-lg) var(--tr-space-md);
		}
		.band {
			top: 22%;
		}
		.band.thin {
			top: 19%;
		}
		.speech {
			padding: var(--tr-space-lg) var(--tr-space-lg) var(--tr-space-xl);
		}
		.discord {
			font-size: var(--tr-text-md);
		}
	}
</style>
