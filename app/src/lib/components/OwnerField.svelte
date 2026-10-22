<script lang="ts">
	import { Field, useUi } from '@treasure/ui';
	import type { Owner } from '@treasure/db';

	interface Props {
		/** The saved owner; new things start as the sister who is using the app. */
		value: Owner;
	}

	let { value }: Props = $props();
	const ui = useUi();
	const words = $derived(ui.copy.personas);
	const uid = $props.id();
	const owners = ['makoto', 'sae', 'shared'] as const;
</script>

<Field label={words.label} for="{uid}-owner">
	<select id="{uid}-owner" name="owner" {value}>
		{#each owners as owner (owner)}
			<option value={owner}>{words[owner]}</option>
		{/each}
	</select>
</Field>
