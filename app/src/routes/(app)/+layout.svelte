<script lang="ts">
	import { goto, onNavigate } from '$app/navigation';
	import { formatMoney, money } from '@treasure/core';
	import { page } from '$app/state';
	import { Notice, Shell, Sheet, Toast, useUi } from '@treasure/ui';
	import TransactionForm from '#lib/components/TransactionForm.svelte';
	import { notify, toast } from '#lib/toast.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const ui = useUi();
	const copy = $derived(ui.copy);

	let adding = $state(false);

	const wallet = $derived({
		label: copy.terms.total,
		text: formatMoney(money(data.wallet.amount, data.wallet.currency), { locale: ui.locale })
	});

	/* The red slash between pages (layout.page_transition), where the browser can do it. */
	onNavigate((navigation) => {
		const root = document.documentElement;
		if (
			!document.startViewTransition ||
			root.dataset.transition !== 'slash' ||
			root.dataset.motion === 'off' ||
			matchMedia('(prefers-reduced-motion: reduce)').matches ||
			navigation.from?.url.pathname === navigation.to?.url.pathname
		) {
			return;
		}
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	const nav = $derived(
		(
			[
				{ href: '/', icon: 'home', key: 'dashboard' },
				{ href: '/transactions', icon: 'activity', key: 'transactions' },
				{ href: '/accounts', icon: 'wallet', key: 'accounts' },
				{ href: '/recurring', icon: 'repeat', key: 'recurring' },
				{ href: '/budgets', icon: 'gauge', key: 'budgets' },
				{ href: '/treasures', icon: 'gem', key: 'goals' },
				{ href: '/reports', icon: 'chart', key: 'reports' },
				{ href: '/system', icon: 'gear', key: 'system' }
			] as const
		).map((item) => ({
			...item,
			label: copy.nav[item.key],
			hint: copy.nav_hints[item.key],
			active:
				item.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(item.href)
		}))
	);

	function openAdd() {
		if (data.accounts.length === 0) {
			goto('/accounts?new=1');
			return;
		}
		adding = true;
	}

	// Messages handed over by redirects (after editing or deleting a transaction).
	$effect(() => {
		const params = page.url.searchParams;
		if (params.has('saved')) notify(copy.transactions.saved);
		if (params.has('deleted')) notify(copy.transactions.deleted);
	});

	function shortcut(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const typing = target?.closest('input, textarea, select, [contenteditable]');
		if (
			!typing &&
			!adding &&
			event.key === 'n' &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		) {
			event.preventDefault();
			openAdd();
		}
	}

	const initial = $derived({
		kind: 'expense' as const,
		date: data.today,
		amount: '',
		accountId: data.accounts[0]?.id ?? '',
		categoryId: '',
		toAccountId: data.accounts[1]?.id ?? '',
		toAmount: '',
		note: ''
	});
</script>

<svelte:window onkeydown={shortcut} />

{#snippet problems()}
	{#each data.problems as problem (problem.title)}
		<Notice tone={problem.tone} title={problem.title}>{problem.detail}</Notice>
	{/each}
{/snippet}

<Shell
	appName={copy.app_name}
	logo={page.data.logo}
	{nav}
	menuLabel={copy.nav.menu}
	words={{
		heading: copy.nav.menu_heading,
		plate: { title: copy.nav.menu_title, hint: copy.nav.menu_hint },
		close: copy.actions.close,
		confirm: copy.nav.confirm,
		move: copy.nav.move
	}}
	{wallet}
	art={page.data.menuArt}
	action={{ label: copy.actions.quick_add, onclick: openAdd }}
	banner={data.problems.length > 0 ? problems : undefined}
>
	{@render children()}
</Shell>

<Sheet
	open={adding}
	title={copy.actions.quick_add}
	closeLabel={copy.actions.close}
	onclose={() => (adding = false)}
>
	<TransactionForm
		action="/transactions?/create"
		accounts={data.accounts}
		categories={data.categories}
		notes={data.notes}
		{initial}
		remember
		onsaved={() => {
			adding = false;
			notify(copy.transactions.saved);
		}}
	/>
</Sheet>

<Toast message={toast.message} key={toast.key} />
