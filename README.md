# Niijima Treasury

A private, self-hosted finance tracker for the Niijima Network, at
`treasure.niijimasisters.com`. It answers three questions: what you have, what you spend, and
what you will have on any future date. Everything you save ends up in your Google Drive
(`Niijima-network/Treasure/`), and the whole app moves to a new server by copying a few YAML
files.

## Status

**All seven milestones are done.** Next up is the Niijima Network homepage, which reads this
app's `/api/summary` feed.

What it does:

- **Sign-in** with Discord; only the account ids in `config.yml` get in, and you stay signed in
  on each device.
- **Accounts** in any supported currency, with a starting balance; archive the ones you close.
  Categories are managed on the same page.
- **Add** button on every page (or the `n` key): spending, income, or a transfer. A transfer
  between currencies takes both real amounts, so the rate is exactly what your bank used.
- **Activity**: month by month, with search and filters; tap any entry to edit or delete it.
- **Exchange rates** from OTP Bank (middle, buy and sell), with the MNB's official rates as a
  backup, fetched every 2 hours on weekdays and only for currencies you hold. Foreign accounts
  join the HUF total at the latest rate. You can also set a rate by hand on the System page.
- **Recurring** items (rent, salary, subscriptions, yearly bills): logged automatically when due,
  or waiting for you to confirm the real amount.
- **Forecast** on the dashboard: your balance day by day for the coming months, from recurring
  items plus your usual everyday spending, with the lowest point and a "what if" for one-off
  purchases.
- **Budgets** per spending category, with a pace marker showing where you should be today.
- **Treasures** (savings goals), either tied to a savings account or filled by hand, with how
  much to put aside each month and when you'll get there at your current pace.
- **Verdicts**: everything that needs attention (budget crossed, balance dipping below your
  floor, items waiting, backups failing, stale rates), on the dashboard and, optionally, posted to
  a Discord channel through a webhook.
- **Reports**: income and spending per month, total over time, where the money went, and CSV or
  JSON exports. A CSV of each month is also written to Drive every night.
- `style.yml`: one file for every color, font, size, motion, layout choice and word.
- **Command menu** (Menu button or Esc): the Network screen from niijimasisters.com: calendar,
  the highlighted command in cut-out letters on its blade, a speech box and the total. Put
  character art in the Drive folder under `art/` and name it in `style.yml` (`assets → menu_art`),
  one image for every command or one per command; until then the command's number stands in.
- **The landing page's look** throughout: its colours, cut-out fonts, buttons, plates and stamps,
  the "Take your time" loader when a page is slow, and the 404 Palace for missing pages.
- Encrypted snapshots to Drive, restore-on-start, and overwrite protection.
- `/api/summary` for the homepage and `/healthz` for the container health check.

## Set up on the server

You need Docker with Compose, your Traefik and Cloudflare Tunnel, and the rclone mount of Google
Drive.

1. **Create the Drive folder.** Make `Niijima-network/Treasure` in your Drive. The app never
   creates it, so a dead mount can't be mistaken for an empty Drive.

2. **Mount that folder with rclone** (its own mount, e.g. at `/mnt/treasure`) so the container
   can write whole files:

   ```
   rclone mount gdrive:Niijima-network/Treasure /mnt/treasure \
     --vfs-cache-mode writes --allow-other --uid 1000 --gid 1000
   ```

   Use your own user and group ids (`id -u`, `id -g`), and put the same numbers in `.env` as
   `PUID` and `PGID` and the mount folder as `TREASURE_DRIVE_DIR`.

3. **Get the code and your settings files.**

   ```sh
   git clone https://github.com/sopika2/project-niijima-treasure.git treasure
   cd treasure
   cp config.example.yml config.yml
   cp .env.example .env
   ```

4. **Create the snapshot key** and put the `SNAPSHOT_KEY=…` line in `.env`. Either tool works:

   ```sh
   pnpm keygen          # on a machine with Node.js 22 and this repo installed
   age-keygen           # the age tool; use the AGE-SECRET-KEY-1… line
   ```

   Also save the key in a password manager. Without it, the snapshots on Drive can't be opened.

5. **Set up Discord sign-in.** In the [Discord Developer Portal](https://discord.com/developers/applications),
   create an application, open **OAuth2**, copy the **Client ID** and **Client Secret** into
   `.env`, and add the redirect `https://treasure.niijimasisters.com/auth/callback`. Fill
   `SESSION_SECRET` with `openssl rand -hex 32`. Your Discord user id goes in `config.yml` under
   `access.discord_user_ids`; if you don't know it, sign in once and the page shows it.

6. **Check the Traefik settings in `.env`:** `TRAEFIK_NETWORK` (the Docker network Traefik
   watches) and `TRAEFIK_ENTRYPOINT` (the entrypoint cloudflared sends traffic to). With your
   wildcard tunnel route, nothing changes in Cloudflare.

7. **Start it.**

   ```sh
   docker compose up -d --build
   docker compose logs -f treasure
   ```

   The log ends with `ready · … drive reachable …`. Open the System page: the backup state turns
   to "Saved to Drive" two minutes after the first start.

## Day to day

| To change            | Edit               | Then                                      |
| -------------------- | ------------------ | ----------------------------------------- |
| How it looks, words  | `style.yml`        | Nothing; it reloads by itself             |
| How it behaves       | `config.yml`       | `docker compose restart treasure`         |
| Secrets, sign-in     | `.env`             | `docker compose up -d`                    |
| The app itself       | `git pull`         | `docker compose up -d --build`            |
| Check a style change | `pnpm style:check` | Prints every problem with its line number |

`style.yml` and `config.yml` are copied to Drive with every snapshot, so your look and settings
are backed up too.

## Backups and restoring

Drive holds, in `Niijima-network/Treasure/`:

```
config.yml, style.yml   copies of your settings
definitions.yml         readable list of accounts, categories, rules, budgets, treasures
snapshots/latest.db.age the newest encrypted database, and latest.json describing it
snapshots/daily/        one per day, the last 14
snapshots/monthly/      one per month, the last 12
```

- **New server or lost data:** start the app with an empty `data/` folder and the same
  `SNAPSHOT_KEY`. It restores `latest.db.age` before opening.
- **Older copy:** stop the app, decrypt the copy you want into `data/treasury.db`, start it.

  ```sh
  age -d -i key.txt snapshots/daily/2026-10-18.db.age > data/treasury.db
  ```

- **If Drive holds a newer or different database,** the app refuses to overwrite it and the
  System page says why. This is what protects you when a mount fails or two servers run at once.
- **To start over on purpose,** delete `snapshots/latest.*` on Drive and the local `data/` folder.

## Moving to another server

Stop the old server first, so it can't write a stale snapshot. On the new one, `git clone` the
repo, copy in your `config.yml`, `style.yml` and `.env` (the Drive folder has copies of the first
two), mount the same Drive folder and run `docker compose up -d --build`. The app restores itself
from Drive.

## Homepage feed

The homepage reads the numbers over the internal Docker network:

```sh
curl -H "Authorization: Bearer $SUMMARY_TOKEN" http://niijima-treasure:3000/api/summary
```

Amounts are in minor units (divide by 100). `projected`, `next_bills`, `budgets_over_warn` and
`treasures` fill in as their milestones land. Set `SUMMARY_TOKEN` in `.env` to turn the feed on;
the homepage container must be on the same Docker network.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:5173, sign-in off, Drive stand-in in ./drive-dev
pnpm verify     # format check, lint, layer rules, type checks, tests, production build
```

Needs Node.js 22.18 or newer and pnpm 10. Development settings are in `app/.env.development`; a
`config.yml` in the repo root is optional there.

### How the code is split

```
packages/core       pure logic: money, currencies, conversion, config.yml
packages/db         SQLite schema, migrations, snapshots to Drive
packages/style      style.yml validation and CSS generation
packages/stats-sdk  the read-only data API extensions use
packages/ui         components; every look comes from style.yml
app                 SvelteKit pages and API routes; wiring only
extensions          charts and statistics, one folder each (see extensions/README.md)
style.yml           the one style file
```

`pnpm lint` enforces the split: core can't import a framework or storage, ui can't read data,
extensions can only use `stats-sdk` and `ui`, and no component may hard-code a color or font.

Money is always stored as whole minor units (fillér, cents) with its currency, never as a
floating-point number. Schema changes are Drizzle migrations: edit `packages/db/src/schema.ts`,
run `pnpm db:generate`, commit the new file in `packages/db/migrations`.
