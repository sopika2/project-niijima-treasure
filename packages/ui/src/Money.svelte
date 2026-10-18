<script lang="ts">
	import { formatMoney, money } from '@treasure/core';
	import { useUi } from './context.ts';

	interface Props {
		/** Whole minor units (fillér, cents). */
		amount: number;
		currency: string;
		/** Prefix + for positive amounts. */
		signed?: boolean;
		/** Color positive amounts as income and negative as expense. */
		tone?: 'auto' | 'none';
		size?: 'sm' | 'md' | 'lg' | 'xl';
	}

	let { amount, currency, signed = false, tone = 'none', size = 'md' }: Props = $props();
	const ui = useUi();

	const text = $derived(formatMoney(money(amount, currency), { locale: ui.locale, signed }));
	const direction = $derived(tone === 'none' || amount === 0 ? 'flat' : amount > 0 ? 'in' : 'out');
</script>

<span class="money" data-direction={direction} data-size={size}>{text}</span>

<style>
	.money {
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
		white-space: nowrap;
	}
	[data-direction='in'] {
		color: var(--tr-color-income);
	}
	[data-direction='out'] {
		color: var(--tr-color-expense);
	}
	[data-size='sm'] {
		font-size: var(--tr-text-sm);
	}
	[data-size='lg'] {
		font-size: var(--tr-text-lg);
		font-weight: var(--tr-weight-bold);
	}
	[data-size='xl'] {
		font-size: var(--tr-text-xxl);
		font-weight: var(--tr-weight-heading);
		line-height: 1.05;
	}
</style>
