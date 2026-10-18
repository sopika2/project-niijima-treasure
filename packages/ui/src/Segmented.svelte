<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
		tone?: 'income' | 'expense' | 'neutral';
	}

	interface Props {
		/** Form field name; the choice is submitted like a normal radio group. */
		name: string;
		label: string;
		options: readonly Option[];
		value: T;
	}

	let { name, label, options, value = $bindable() }: Props = $props();
</script>

<fieldset class="segmented">
	<legend class="visually-hidden">{label}</legend>
	{#each options as option (option.value)}
		<label data-tone={option.tone ?? 'neutral'} class:checked={value === option.value}>
			<input type="radio" {name} value={option.value} bind:group={value} />
			<span>{option.label}</span>
		</label>
	{/each}
</fieldset>

<style>
	.segmented {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: var(--tr-space-xs);
		margin: 0;
		padding: var(--tr-space-xs);
		border: 0;
		border-radius: var(--tr-radius-md);
		background: var(--tr-color-background);
	}
	label {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 2.5rem;
		padding: 0 var(--tr-space-sm);
		color: var(--tr-color-text-muted);
		font-weight: var(--tr-weight-bold);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-sm);
		cursor: pointer;
		isolation: isolate;
	}
	label::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: var(--tr-color-surface-raised);
		transform: skewX(var(--tr-skew)) scaleX(0);
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	label.checked {
		color: var(--tr-color-text);
	}
	label.checked::before {
		transform: skewX(var(--tr-skew)) scaleX(1);
	}
	label.checked[data-tone='expense']::before {
		background: var(--tr-color-accent);
	}
	label.checked[data-tone='expense'] {
		color: var(--tr-color-accent-text);
	}
	label.checked[data-tone='income']::before {
		background: var(--tr-color-income);
	}
	label.checked[data-tone='income'] {
		color: var(--tr-color-background);
	}
	label.checked[data-tone='neutral']::before {
		background: var(--tr-color-secondary);
	}
	label.checked[data-tone='neutral'] {
		color: var(--tr-color-secondary-text);
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	label:has(input:focus-visible) {
		outline: 2px solid var(--tr-color-focus-ring);
		outline-offset: 2px;
	}
</style>
