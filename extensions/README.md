# Extensions

Charts and statistics live here, one folder each, so they never clutter the core code.
An extension can **read** data and **draw** it. It cannot write, touch the database, or
reach the network.

```
extensions/
  status-card/
    extension.yml   what it is, where it shows, what data it reads, its settings
    query.ts        runs on the server, returns plain data for the widget (optional)
    Widget.svelte   draws that data with @treasure/ui components
```

## extension.yml

```yaml
id: status-card # must match the folder name
name: Status card
version: 1.0.0
description: One line about what it shows.
placement: dashboard # dashboard | reports
size: wide # normal | wide (full row on the dashboard)
reads: # the only data it may read; anything else is refused
  - system
  - accounts
settings: # optional; users override them in config.yml
  show_details:
    type: boolean # boolean | number | text | choice
    default: true
```

Data sources available now: `system`, `accounts`. More arrive with each milestone
(transactions, projection, budgets, treasures, rates).

## query.ts

```ts
import { defineQuery } from '@treasure/stats-sdk';

export default defineQuery(async ({ stats, settings, baseCurrency, locale, today }) => {
  const { total } = await stats.accounts();
  return { total };
});
```

## Widget.svelte

Receives `data` (what `query.ts` returned) and `settings`. Use `@treasure/ui` components and
`var(--tr-…)` variables only; `pnpm lint` fails on hard-coded colors or fonts, so every
extension follows `style.yml` automatically.

## Turning extensions on and off

Extensions are compiled into the app. Which ones run is set in `config.yml`, and their order on
the dashboard in `style.yml` (`layout.dashboard_order`):

```yaml
# config.yml
extensions:
  - status-card
  - id: spending-by-category
    settings:
      months: 6
```

Removing an extension means deleting its folder and its line in `config.yml`. Nothing else changes.
