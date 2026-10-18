<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button, Card, Icon, PageHeader, useUi } from '@treasure/ui';
	import TransactionForm from '#lib/components/TransactionForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ui = useUi();
</script>

<PageHeader title={ui.copy.transactions.edit}>
	{#snippet actions()}
		<Button href="/transactions?month={data.values.date.slice(0, 7)}" variant="ghost">
			<Icon name="left" />{ui.copy.actions.close}
		</Button>
	{/snippet}
</PageHeader>

<div class="layout">
	<Card>
		{#key data.values.id}
			<TransactionForm
				action="?/update"
				accounts={data.accounts}
				categories={data.categories}
				notes={page.data.notes}
				initial={data.values}
			/>
		{/key}
	</Card>

	<form
		method="POST"
		action="?/delete"
		class="delete"
		use:enhance={({ cancel }) => {
			if (!confirm(ui.copy.transactions.delete_confirm)) cancel();
		}}
	>
		<Button type="submit" variant="danger"><Icon name="trash" />{ui.copy.actions.delete}</Button>
	</form>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--tr-space-lg);
		max-width: 36rem;
	}
	.delete {
		display: flex;
		justify-content: flex-start;
	}
</style>
