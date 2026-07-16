# Phase 0.1 — CJ Dropshipping Catalogue Validation

Status: **live account confirmed, partial catalogue signal gathered, full match confirmation still needs the Phase 1 supplier-linker step.** This is an honest interim result, not a pass/fail on the ≥15/20 @30% margin acceptance criterion — see "What this does and doesn't prove" below.

## What was done

1. Read the CJ API key from `.env` (`CJ_DROPSHIPPING_API`), stored it in Supabase Vault on the `chronos-dev` branch (`moatcohllmhgabanxlqr`) rather than leaving it as the only copy in a plaintext repo file.
2. Called `POST /api2.0/v1/authentication/getAccessToken` live. **Success.** Real CJ business account, `openId 42784`, access token valid to 2027-01-12.
3. Pulled the current catalogue directly from production (`whuqfxdzopyucebtnbkx`, read-only): 19 distinct products in `products` + 21 distinct in `pool_products`, ~20 unique SKUs total, cost prices $8.39–$60, listing prices $20–$89.
4. Ran a live keyword search (`GET /api2.0/v1/product/listV2`) against CJ for all 20, respecting their 1 request/second rate limit.

## What this does and doesn't prove

CJ's `listV2` keyword search is a flat text search across their **entire multi-category marketplace** (millions of SKUs, everything from apparel to electronics to pet supplies) — it is not scoped to apparel or ranked by visual/style similarity. Several of our keywords collided with unrelated products sharing the same word:

- "jumper" matched network/Ethernet cable jumpers and PC hardware jumpers as often as knitwear
- "tee" matched golf tees and golf accessories
- "button" matched PS4 controllers and car key fobs

Net effect: **8 of 20 searches returned a plausible, on-style candidate; 12 returned noise** that a human (or a better-scoped, category-filtered query) would immediately discard. This is a search-methodology limitation, not evidence CJ lacks the inventory — CJ's apparel categories are enormous; a generic flat-text query just isn't precise enough to stand in for the actual per-SKU picking step.

## Plausible matches found (price-viable signal)

| Our product | Our cost (AUD, unconfirmed) | Our listing | CJ candidate | CJ price (USD) |
|---|---|---|---|---|
| Abercrombie & Fitch gray zip up hoodie w/ fur hood | $34 | $59 | Women's Fuzzy Full-Zip Hoodie Sweatshirt | $6.20 |
| Cute Short Shorts Fur Lining Denim | $20 | $48 | American Retro Denim Super Short Shorts | $9.00 |
| Pink Abercrombie & Fitch fur hooded jacket | $36 | $79 | Women's Thermal Fur Collar Hooded Jacket | $22.39–24.03 |
| Y2k Crop Top Slim Summer Tee | $20 | $48 | Streetwear Chiffon Crop Top (sleeveless, lace-up) | $4.19–15.49 |
| Y2k Short Sleeve Minimalist Graphic Crop Top Tee | $22 | $48 | Crop Top Sweetheart Solid Ribbed | $3.23–3.62 |
| Y2k 2000s Style Striped Long Sleeve Crop Top Sweater | $35 | $67 | Off-shoulder Knit Crop Sweater Top | $5.64 |
| Y2K Punk Style Women's Belt | $8.39 | $20 | Punk Double-Row Casual Belt / Rivet Punk Collar Belt | $1.55–4.35 |
| Fur Collar Leopard Print Y2K Zip-up Jumper | $55 | $89 | *(weak — no true fur-collar leopard zip-up found in top 3)* | — |

Even taking these at face value with USD list price only (no freight, no FX applied yet), CJ's per-unit cost is dramatically below what Sync currently pays — directionally consistent with the build plan's Problem 1 diagnosis (current AliExpress-retail sourcing has near-zero margin). That's a real, useful signal even before per-SKU picking is finished.

## The other 12 — graphic tees, most "jumper"-branded jackets, cross/gothic prints

These need a scoped pass: search within CJ's apparel category tree (`getCategory` → filter `listV2` by `categoryId`) plus a visual check against product images, not just keyword text. That's real work, not a placeholder — and it's exactly the job the build plan already assigns to Phase 1's **admin "supplier product linker"** (§1.3): an admin attaches the correct CJ SKU per master-catalogue product, one time, by hand. I'm building that tool next as part of Phase 1 rather than trying to fake-automate SKU picking with text search.

## Currency correction (founder-confirmed, supersedes the draft above)

Founder confirmed: **settlement currency is AUD**, and current landed cost (product + shipping, all-in) runs **$20–60 AUD per item** — not the raw USD product-only price used in the first pass above. That first pass compared CJ's USD *product-only* price against our AUD *all-in landed* cost, which overstates the margin. Corrected methodology, run live against 3 of the 8 plausible matches using CJ's real `freightCalculate` endpoint (CN→AU) and the day's actual FX rate (1 USD = 1.43 AUD, 2026-07-16):

| SKU | CJ product (USD) | CJ freight to AU (USD) | Landed (USD) | Landed (AUD) | Our current cost (AUD) | Our listing (AUD) | Margin at listing |
|---|---|---|---|---|---|---|---|
| CJWY1617806 — Fuzzy Full-Zip Hoodie | $6.20 | $8.33 | $14.53 | **$20.78** | $34 | $59 | **64.8%** ✅ |
| CJNZ2056421 — Retro Denim Shorts | $9.00 | $8.33 | $17.33 | **$24.78** | $20 | $48 | **48.4%** ✅ (landed cost is actually *higher* than what we pay today for this one — still clears the floor on listing price, but not the free win it looked like in USD-only terms) |
| CJNS1048724 — Fur Collar Hooded Jacket | $22.39–24.03 | $17.06 | ~$40.27 | **$57.59** | $36 | $79 | **27.1%** ❌ below the 30% floor |

This is exactly the failure mode the founder flagged: the jacket looked fine at a glance ("$24 USD, cheap") but freight roughly doubles the landed cost, and once converted to AUD it lands *above* margin floor territory, not comfortably under it. **This candidate should not be used as-is** — needs either a cheaper CJ alternative, a higher listing price, or accepting it as a lower-margin line.

**Corrected rule going forward (baked into Phase 1's `nightly-price-sync` and margin-floor logic):** margin is only ever computed as `(listing_price_AUD − (cj_sellPrice_USD + cj_freight_USD) × fx_rate) / listing_price_AUD`, never off product price alone. The FX rate itself will be re-pulled per run, not hardcoded.

## Honest read on the Phase 0 acceptance criterion

> "≥15 of 20 current products matched or substituted at ≥30% gross margin at current sell prices"

Not yet certifiable, and now stricter than the first draft: of the 8 plausible matches, only 3 have been checked with real freight+FX so far — 2 clear 30%, 1 doesn't. The other 5 plausible matches and the 12 unresolved searches still need the same freight+FX treatment. What's certain: the CJ account is live and working end to end (auth → search → freight quote, all real calls), and the methodology now correctly accounts for the founder's AUD/landed-cost correction. What's not certain: the final ≥15/20 count — that requires running all ~20 through this same freight+FX check, which is mechanical but needs the real per-SKU picks first (the supplier-linker step). I'm carrying this forward as a concrete Phase 1 task rather than estimating it.
