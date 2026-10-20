/** Shapes the server hands to pages; safe to import from components. */

export interface AccountOption {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly currency: string;
	/** The date its starting balance is for (YYYY-MM-DD). */
	readonly openingDate: string;
}

export interface CategoryOption {
	readonly id: string;
	readonly name: string;
	readonly kind: 'income' | 'expense';
	readonly color: number;
}

export interface TransactionRow {
	readonly id: string;
	readonly date: string;
	readonly kind: 'income' | 'expense' | 'transfer';
	readonly note: string | null;
	/** Signed amount in the account's currency: positive in, negative out, transfers as sent. */
	readonly amount: number;
	readonly currency: string;
	readonly account: string;
	/** Transfers only. */
	readonly toAccount: string | null;
	readonly toAmount: number | null;
	readonly toCurrency: string | null;
	readonly category: { readonly name: string; readonly color: number } | null;
}
