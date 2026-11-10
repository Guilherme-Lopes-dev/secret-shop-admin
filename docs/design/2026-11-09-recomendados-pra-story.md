# Recomendados pra story (tela própria no admin)

Date: 2026-11-09 · Repos: secret-shop-admin, secret-shop-backend · Status: implemented, reviewed (6 design gaps open, see Review log)

This document describes a feature that is already committed (admin commit `fbdef03`, backend commit `d752022`, both on `main`, not yet deployed). The review checks the design as built.

## Context

The admin panel has a "Tendências" screen (`secret-shop-admin/src/views/market-trends/MarketTrends.vue`) that shows what rose, fell and got hot on the Steam Market and on the site. Until now, at the bottom of that screen there was a "Recomendados pra story" section: the 5 items in our stock with the highest expected profit if an Instagram story pushed their sale, each with a "Criar story" button that opens the Instagram composer pre-filled.

The store owner (the only admin user of this feature) wants to choose which item goes into a story with more control: see every profitable item, filter by hero, by minimum profit, by margin, by signals (in carts, wishlisted, cheaper than Steam, rising on Steam, sold recently, searched, last unit), change the ordering, and control how many items per hero appear. Five fixed items with a hard-coded "max 2 per hero" rule were not enough.

The Instagram composer (`secret-shop-admin/src/views/instagram/InstagramPosts.vue`, around line 927) already reads `skin`, `name`, `hero` and `message` from the route query and opens in story mode with the item and the sentence pre-filled. That contract is unchanged.

## Goals

- A dedicated admin page at `/market-trends/stories` (route name `market-stories`) listing every in-stock skin with at least R$ 5 of profit per unit, ranked by a recommendation score.
- All filtering, sorting, per-hero capping and truncation happens client-side, on the full list returned by the backend.
- Filters persist per browser between visits.
- "Criar story" keeps working exactly as before.
- The Tendências screen stops computing and rendering the story section and links to the new page instead.

## Non-goals

- Learning the score weights from real story results (Instagram insights versus sales). Weights stay hand-tuned.
- Collectors (`bot_inventory.is_collector = true`). They have no registered cost, so profit cannot be computed.
- Pagination or server-side filtering. The full list is small (bounded by the number of distinct skins in stock with known cost).
- Publishing or scheduling stories from this page. It only navigates to the composer.
- Picking a historical day. The candidates are always the stock of right now.

## Current state (before this change)

- Backend: `GET /admin/market-trends` (`secret-shop-backend/src/market-trends/market-trends.controller.ts`, service `market-trends.service.ts`) returned, besides the Steam and site rankings, a `stories` array with the top 5 picks. The ranking function in `market-trends.stories.ts` applied a "max 2 per hero" cut and a top-5 cut.
- Admin: `MarketTrends.vue` rendered `data.stories` as cards inline, with its own `createStory` navigation.

## Proposed design (as built)

### Backend

New endpoint `GET /admin/market-trends/stories?period=1|7|30&minSold7d=<int>` in `MarketTrendsController`. The controller class is guarded by `AdminOrDevGuard` (`@UseGuards(AdminOrDevGuard)` on `admin/market-trends`), so the endpoint inherits admin-only access. Query parsing reuses `parseTrendsQuery`: `period` must be 1, 7 or 30 (default 1 at the backend, but the admin always sends it), `minSold7d` must be a non-negative integer (default `DEFAULT_MIN_SOLD_7D`). Invalid values return 400.

`MarketTrendsService.getStoryPicks(query)`:

1. `day` = the latest day in `market_price_history` (fallback: today in America/Sao_Paulo). `fromDay` = `day` minus `period - 1` days.
2. In parallel:
   - `cachedSteamSnapshot(day, period)`: the same Steam price snapshot the Tendências screen uses. It is cached in memory per (day, period), per process. The latest day is pre-computed on boot and after each Steam sync; other days live 10 minutes. The first computation of a period that is not yet cached can take more than 10 seconds.
   - `loadSiteSales(fromDay, day)`: paid site sales per `market_hash_name` in the window.
   - `loadSearchTerms(fromDay, day)`: store search terms with hit counts in the window, then `collapseTypingPrefixes` merges "pud", "pudg", "pudge" into the final term.
   - `loadStoryInputs()`: the candidates (SQL below) and the current wishlist/cart counts from `DemandService.getDemandSummary({})`. Wishlist and cart are always the current state, not the period.
3. `rankStoryPicks(candidates, context)` (pure function in `market-trends.stories.ts`, covered by `market-trends.stories.spec.ts`) returns every candidate with `sitePrice - avgCost >= 500` cents, sorted by `score` descending. No top-N cut and no per-hero cut anymore.
4. Response: `{ day, fromDay, period, minSold7d, picks }`.

Candidate SQL (`loadStoryCandidates`, raw Prisma query): one row per skin, from `bot_inventory` joined with `skins` and `skins_catalog`, where the unit is not deleted, is not a collector and passes `availableInventorySql()` (the same availability rule the storefront uses). `stock` = count of available units. `sitePrice` = `skins_catalog.effective_price` (what the storefront shows; null means hidden and the skin is excluded). `avgCost` = average `bot_inventory.cost_price` of the available units; units without cost are ignored by `AVG`, and a skin with no costed unit is excluded. `name` is the full `market_hash_name` (keeps "Inscribed"/"Genuine"). `hero` is `NULL` when the skin's hero is `'Other'`.

Per pick, all money in BRL cents:

- `profit = sitePrice - avgCost`, `marginPct = round(profit / sitePrice * 100)`.
- `steamPrice` = Steam consensus price for the day, or null if the item is not in the snapshot.
- `discountVsSteamPct = (steamPrice - sitePrice) / steamPrice`, one decimal. Positive means the store is cheaper.
- `steamChangePct` = price change over the period, only when the item sold at least `minSold7d` times on Steam in the last 7 days; otherwise null (one sale moves an illiquid item's price).
- `favorites`, `inCarts` (current), `siteSold` (period), `searchHits` and `topSearch` (period; a term matches when every word of it appears in name + hero + rarity).
- `score = profit × (1 + interest) × (1 + discountBonus) × (1 + momentumBonus)`, where `interest = 0.3·favorites + 0.6·carts + 0.4·sales + 0.05·searchHits`, and each bonus is the positive percentage clamped to 0..40, divided by 100.
- `hook`: the public sentence for the story, chosen from the strongest signal: ≥10% below Steam → "N% mais barato que na Steam"; ≥5% rising → "Valorizando na Steam — garanta antes que suba"; any favorites → "Um dos mais desejados da loja"; stock 1 → "Última unidade disponível"; otherwise "Disponível agora na Secret Shop". Cart counts never become public text (owner's decision).
- `reasons`: internal bullet points explaining the score, shown only in the admin.

Backward compatibility: `GET /admin/market-trends` still returns `stories: []` so an admin build from before this change (which reads `data.stories.length`) does not crash. A `ponytail:` comment marks it for removal after the new admin is deployed.

### Admin

- Route `market-trends/stories` → `src/views/market-trends/StoryPicks.vue`, added under the authenticated admin layout in `src/router/index.ts`. Sidebar entry "Recomendados pra story" in `src/components/layout/AdminLayout.vue`, next to "Tendências". `MarketTrends.vue` loses the story section and gains a header link to the new page.
- Service `adminService.getMarketStories({ period, minSold7d })` in `src/services/admin/admin.service.ts`, timeout 60 s (same reason as Tendências: the first uncached snapshot of the day can exceed the default 10 s). Types `MarketStoriesResponse` and `StoryPick` in `src/services/admin/types.ts`. Note the global response interceptor renames `uuid` to `id`; the pick field is `skinId`, so it is not affected.
- Page state:
  - `period` (1/7/30, default 7) and `minSold7d` (3/10/30/100, default 10) are server parameters. Changing either refetches. A request token ensures only the latest response writes to the screen (fast toggling cannot show stale data).
  - `filters` is client-only: `search` (text over name, hero, rarity), `hero` (select populated from the heroes present in the response), `minProfit` (R$, compared against cents × 100), `minMarginPct`, `signals` (AND of the selected signals), `sortBy` (score, profit, margin, carts, favorites, discount vs Steam, Steam change, period sales, searches, stock; always descending; nulls last), `maxPerHero` (1/2/3/unlimited, default 2), `limit` (15/30/60/all, default 15).
  - All three are persisted to `localStorage` via the existing `persistedRef` util under keys `stories:period`, `stories:min-sold-7d`, `stories:filters`. A saved filter object is merged over `DEFAULT_FILTERS` so new fields get defaults. If the saved hero no longer exists in the response, it is reset to "all".
  - Filtering is a pure function `applyStoryFilters(picks, filters)` in `src/views/market-trends/storyFilters.ts`: filter → sort → per-hero cap (keeps order, items without hero are never capped) → take first `limit`. It returns `{ matching, visible }`; the page shows "Mostrando X de Y que passam nos filtros (Z itens com lucro no estoque)".
- Card component `src/components/market-trends/StoryCard.vue`: rank, Steam image (fallback icon on error), name, hero · rarity, profit per unit and margin, store/cost/Steam prices and stock, the hook, the reasons, and "Criar story", which pushes `{ name: 'instagram', query: { skin: skinId, name, hero, message: hook } }`.
- States: loading spinner on first load; on refetch the grid stays visible with reduced opacity; error banner (timeout gets a specific "server is still calculating" message); two distinct empty states (no item passes the filters, with a reset link; no profitable item in stock at all).

## Data and API changes

- No schema change, no migration, no new env var.
- New endpoint `GET /admin/market-trends/stories` (admin-only).
- `GET /admin/market-trends` response: `stories` is now always `[]` (kept for compatibility).
- Response size: one pick per distinct profitable skin in stock, each with ~25 fields and up to ~9 short reason strings.

## Rollout and rollback

- Deploy order: backend first (new endpoint + empty `stories`), then admin. Old admin against new backend shows an empty story section on Tendências; new admin against old backend gets 404 on the new page. Backend-first avoids the 404 window.
- Rollback: revert the admin commit; the backend change is additive except for the emptied `stories` array, which only the old admin reads.
- After both are deployed, remove `stories: []` from the backend.

## Risks

- Score weights are hand-picked and unvalidated.
- `avgCost` averages only units that have a cost; a skin with mixed costed and uncosted units shows the average of the costed ones.
- `sitePrice` is `effective_price` from `skins_catalog`; if the storefront applies a discount or coupon on top, real profit is lower than shown.
- In-memory snapshot cache is per process (production runs a single backend instance, so this is fine today).

## Open questions

- Should the filters persist per browser (current) or be shared between admins? Today there is effectively one admin user.
- Should the backend still cap the list (e.g. top 200) to bound payload size if stock grows a lot?

## Review log

Round 1, 2026-11-09, six goldfish (correctness, security, cross-repo contracts, performance and cost, product and UX, operations). Measured against the local prod dump on the same day: about 140 profitable skins in stock, 4 of them hidden from the storefront.

### Design gaps (code must change, pending owner approval)

1. **`sitePrice` can be a price no unit has.** `skins_catalog.effective_price` (matview, `prisma/migrations/20260821130000_skin_visibility_floor/migration.sql`) falls back to `manual_price`, `median_price`, `lowest_price` when every unit is below the protected floor. Those skins are hidden on the storefront (`available_count = 0`) but still become picks with a made-up profit (4 today). Fix: add `AND sc.available_count > 0` to `loadStoryCandidates`. The doc's "null means hidden" was wrong; null only means `visibility_override = false`. (contracts) **Fixed 2026-11-09** (picks on the dump: 140 → 136).
2. **Public hook "Um dos mais desejados da loja" fires on one favorite.** That is a public claim on Instagram. Fix: require a minimum (proposed: 3 favorites) or fall through to the next hook. (UX, security)
3. **Public hook "N% mais barato que na Steam" has no liquidity gate.** `steamChangePct` respects `minSold7d`, `discountVsSteamPct` does not, so an illiquid item's noisy Steam price can become a public price claim. Fix: only use the discount hook (and the discount bonus) when the item passes `minSold7d`. (UX) **Fixed 2026-11-09**: `discountVsSteamPct` is now null for illiquid items, like `steamChangePct`; `steamPrice` is still returned for display. The "Abaixo da Steam" filter follows the same rule.
4. **Persisted filters are not validated.** A stale `signals` key makes `SIGNALS[signal](pick)` throw inside a computed, and since it is in `localStorage` the page breaks on every visit. Fix: on load, keep only known signals, sorts and option values; fall back to defaults otherwise. (security, correctness, contracts)
5. **Per-hero cap still applies when a hero is selected.** Choosing "Pudge" shows at most 2 cards. Fix: ignore `maxPerHero` while `hero` is set. (UX)
6. **A failed refetch wipes the grid.** `data.value = null` in the catch of `fetchPicks`. Fix: keep the last good result under the error banner. (UX)

### Wording gaps (doc fixed or clarified here)

- Rollback: reverting only the admin leaves Tendências with an empty story section, because the backend returns `stories: []`. A full rollback reverts both commits. Removing `stories: []` later makes the old admin crash on `data.stories.length`, so do it only after the new admin has been live a few days with no rollback. (operations, correctness, contracts)
- Cold cache: after a backend restart or Steam sync, the snapshots for Day, Week and Month are rebuilt one at a time, and Month alone takes over 30 s in prod. A request in that window can hit the 60 s admin timeout; the "servidor ainda está calculando" banner is the accepted behavior. (operations, performance)
- `AdminOrDevGuard` only checks `user.admin === true`; "Dev" in the name grants nothing. (security)
- The period window ends at the last Steam sync day, not today. The page subtitle already shows the range. (correctness, UX)
- `discountVsSteamPct` is a percentage with one decimal (`× 100`). `steamChangePct` is also null when there is no price at the start of the window. `image`, `rarity`, `topSearch`, `steamPrice` are nullable. The two sides of the contract are `secret-shop-backend/src/market-trends/market-trends.stories.ts` (`StoryPick`) and `secret-shop-admin/src/services/admin/types.ts` (`StoryPick`), kept in sync by hand. (contracts)
- `minProfit`: the R$ input is multiplied by 100 and compared with `profit` in cents. (contracts, UX)
- Search terms: matching is substring per word, over the top 1000 terms (`SEARCH_TERMS_LIMIT`). (correctness, performance)
- `topSearch` and `reasons` carry text typed by storefront visitors. They are rendered as escaped text (`{{ }}`) and never copied into `hook` or the composer's `message`. (security)
- No feature flag: single admin user, additive endpoint, rollback by revert. No alerting: failures surface only in the error banner. (operations)

### Accepted risks

- Interest signals (searches, favorites, carts) can be inflated by outsiders. Weights are small and the owner picks the story by hand. (security)
- `getDemandSummary({})` runs heavier all-time queries than needed, and changing `minSold7d` refetches everything. With about 140 picks and one admin user this is acceptable; revisit if the endpoint shows up in slow logs. (performance)
- Collector demand and sales with the same `market_hash_name` add to a skin's score; carts have no age cap. Both inflate interest a bit; the owner reviews each story. (correctness)
- The hook can change when the period changes, and it is not rechecked at publish time. The composer asks the owner to review the text. (UX, correctness)

### Rejected

- Top-N cap, pagination, debounce, O(n²) `capPerHero`, lazy images: about 140 items today, so none of these matter yet.
- Moving the `minSold7d` gate to the client: saves one refetch on a control that rarely changes.
- `?minSold7d=` (empty) becomes 0: admin-only endpoint, and the admin always sends a value from a fixed list.
- Narrower permission for cost data: every `admin=true` account already sees costs on other screens.

### Small polish (optional)

- Empty-state copy "lucro acima de R$ 5" should say "de pelo menos R$ 5", matching the rule `>= 500`.
- The result line could say how many items were cut by the per-hero rule versus the limit.
- `dropMissingHero` writes the reset to storage, so a hero that is out of stock for a moment loses the saved choice.
