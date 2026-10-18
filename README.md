# Niijima Treasury

A private, self-hosted finance tracker for the Niijima Network, at
`treasure.niijimasisters.com`. It answers three questions: what you have, what you spend, and
what you will have on any future date. Everything you save ends up in your Google Drive
(`Niijima-network/treasure/`), and the whole app moves to a new server by copying a few YAML
files.

## Status

**Milestone 1 of 7, the foundation, is done.** It runs, signs you in through Cloudflare Access,
backs itself up to Drive and restores itself from there. There is nothing to enter yet: accounts
and transactions arrive in milestone 2.

| #   | Milestone                    | State |
| --- | ---------------------------- | ----- |
| 1   | Foundation                   | Done  |
| 2   | Accounts and transactions    | Next  |
| 3   | OTP and MNB exchange rates   |       |
| 4   | Recurring items              |       |
| 5   | Projection and homepage feed |       |
| 6   | Budgets, Treasures, Verdicts |       |
| 7   | Reports and polish           |       |

What works now:

- Dashboard and System pages in the Niijima look, on phone and desktop.
- `style.yml`: one file for every color, font, size, motion, layout choice and word. Edits apply
  within a second, and a typo is rejected with the line number while the last good version stays.
- Encrypted snapshots to Drive two minutes after any change, on shutdown, and nightly with dated
  daily and monthly copies. If this server has no database, it restores the latest one from Drive.
- Safeguards so a snapshot never overwrites a different or newer database on Drive.
- Cloudflare Access check on every request, plus an optional email allow-list.
- `/api/summary` for the homepage and `/healthz` for the container health check.
- The extension system, with the status card as the first extension.

## Set up on the server

You need Docker with Compose, your Traefik and Cloudflare Tunnel, and the rclone mount of Google
Drive.

1. **Create the Drive folder.** Make `Niijima-network/treasure` in your Drive. The app never
   creates it, so a dead mount can't be mistaken for an empty Drive.

2. **Mount Drive so the container can write whole files.** If the mount isn't set up like this
   yet, add these flags to your rclone mount:

   ```
   --vfs-cache-mode writes --allow-other --uid 1000 --gid 1000
   ```

   Use your own user and group ids (`id -u`, `id -g`) and put the same numbers in `.env` as
   `PUID` and `PGID`.

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

5. **Protect the address with Cloudflare Access.** In Zero Trust, add a self-hosted application for
   `treasure.niijimasisters.com` with a policy that allows only your email. Copy its
   **Application Audience (AUD) Tag** into `CF_ACCESS_AUD`, and your team domain
   (e.g. `niijima.cloudflareaccess.com`) into `CF_ACCESS_TEAM_DOMAIN`.

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

Drive holds, in `Niijima-network/treasure/`:

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
