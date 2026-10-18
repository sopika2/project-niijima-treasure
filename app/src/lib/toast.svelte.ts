/** One toast for the whole app: any page can call notify(), the layout shows it. */
export const toast = $state({ message: '', key: 0 });

// Counted outside the state on purpose: notify() never reads reactive state, so calling it
// from an effect can't make that effect depend on the toast and loop.
let shown = 0;

export function notify(message: string): void {
	shown += 1;
	toast.message = message;
	toast.key = shown;
}
