<script lang="ts">
	import { Icon, useUi } from '@treasure/ui';
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
	<div class="slab" aria-hidden="true"></div>
	<div class="slab slab-echo" aria-hidden="true"></div>
	<div class="dots" aria-hidden="true"></div>

	<section class="panel" aria-labelledby="signin-title">
		<p class="kicker"><span>{words.kicker}</span></p>
		<h1 id="signin-title" class="title">{words.title}</h1>
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

		<a class="discord" {href}>
			<span class="discord-inner">
				<Icon name="discord" size="1.5em" />
				{words.button}
			</span>
		</a>

		<p class="note">{words.note}</p>
	</section>
</main>

<style>
	.signin {
		position: relative;
		isolation: isolate;
		display: grid;
		align-items: center;
		min-height: 100dvh;
		overflow: hidden;
		padding: var(--tr-space-xl) var(--tr-space-lg);
		background: var(--tr-color-background);
	}

	/* The red slab that cuts across the screen, Persona-menu style. */
	.slab {
		position: absolute;
		z-index: -2;
		inset: -10% -20% -10% 52%;
		background: var(--tr-color-accent);
		clip-path: polygon(18% 0, 100% 0, 100% 100%, 0 100%, 9% 58%, 3% 54%);
		animation: sweep var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}
	.slab-echo {
		z-index: -3;
		inset: -10% -20% -10% 49%;
		background: var(--tr-color-surface-raised);
		animation-delay: 60ms;
	}
	.dots {
		position: absolute;
		z-index: -1;
		inset: 0 0 0 55%;
		background-image: radial-gradient(var(--tr-color-background) 1.2px, transparent 1.6px);
		background-size: 10px 10px;
		opacity: 0.35;
		mask-image: linear-gradient(115deg, transparent 20%, black 70%);
	}

	.panel {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-md);
		width: min(34rem, 100%);
		padding: var(--tr-space-xl);
		background: var(--tr-color-surface);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
		box-shadow: var(--tr-shadow-raised);
		animation: enter var(--tr-duration-slow) var(--tr-ease-emphasized) both;
	}

	.kicker {
		margin: 0;
		padding: 2px var(--tr-space-sm);
		background: var(--tr-color-text);
		color: var(--tr-color-background);
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-bold);
		letter-spacing: 0.18em;
		text-transform: uppercase;
		transform: skewX(var(--tr-skew));
	}
	.kicker span {
		display: inline-block;
		transform: skewX(calc(var(--tr-skew) * -1));
	}

	.title {
		margin: 0;
		font-size: clamp(2.75rem, 11vw, 4.5rem);
		overflow-wrap: anywhere;
		line-height: 0.9;
		color: var(--tr-color-text);
		text-shadow: 0.06em 0.06em 0 var(--tr-color-accent);
	}

	.subtitle {
		margin: 0;
		max-width: 28ch;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-lg);
		line-height: 1.35;
	}

	.message {
		display: grid;
		gap: var(--tr-space-sm);
		width: 100%;
		padding: var(--tr-space-md);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-secondary);
		background: var(--tr-color-surface-raised);
	}
	.message[data-tone='warning'] {
		border-color: var(--tr-color-warning);
	}
	.message[data-tone='danger'] {
		border-color: var(--tr-color-danger);
	}
	.message p {
		margin: 0;
	}
	.help {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	.id {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: var(--tr-space-sm);
		padding: var(--tr-space-xs) var(--tr-space-sm);
		border: var(--tr-border-width) solid var(--tr-color-border);
		border-radius: var(--tr-radius-sm);
		background: var(--tr-color-background);
		color: var(--tr-color-text);
		font: inherit;
		cursor: pointer;
	}

	/* The big slanted button with a hard offset shadow. */
	.discord {
		display: inline-block;
		margin-block-start: var(--tr-space-sm);
		padding: var(--tr-space-md) var(--tr-space-lg);
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
		text-decoration: none;
		font-weight: var(--tr-weight-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-lg);
		transform: skewX(var(--tr-skew));
		box-shadow: 6px 6px 0 var(--tr-color-text);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-standard),
			box-shadow var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.discord:hover {
		transform: skewX(var(--tr-skew)) translate(-2px, -2px);
		box-shadow: 9px 9px 0 var(--tr-color-text);
	}
	.discord:active {
		transform: skewX(var(--tr-skew)) translate(4px, 4px);
		box-shadow: 2px 2px 0 var(--tr-color-text);
	}
	.discord-inner {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-sm);
		transform: skewX(calc(var(--tr-skew) * -1));
	}

	.note {
		margin: 0;
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translateX(-2rem) skewX(4deg);
		}
	}
	@keyframes sweep {
		from {
			transform: translateX(30%);
		}
	}

	@media (max-width: 700px) {
		.signin {
			align-items: end;
			padding: var(--tr-space-md);
		}
		.slab {
			inset: -5% -30% 45% 20%;
		}
		.slab-echo {
			inset: -5% -30% 43% 15%;
		}
		.dots {
			inset: 0 0 50% 30%;
		}
		.panel {
			padding: var(--tr-space-lg);
		}
		.discord {
			justify-self: stretch;
			text-align: center;
			font-size: var(--tr-text-md);
			white-space: nowrap;
		}
	}
</style>
