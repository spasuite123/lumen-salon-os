# Decisions

A running log of architecture decisions and *why*, so they don't have to be
re-litigated later. Newest at the top.

## ADR-005 · Per-store inventory, org-level product catalog
A product is defined once per org (`products`); stock is tracked per location
(`product_inventory`, PK `(product_id, store_id)`). Same SKU, independent counts.
Catalog edits are owner/manager; stock adjustments are owner/manager/front_desk
(front desk receives/sells at their own store). Memberships, packages, and gift
cards are org-wide (valid/redeemable at any location), matching customer expectation.

## ADR-004 · Stylists can read the whole floor, write only their own book
Stylists need to see the full day at their store (gaps, who's in) but should not
edit colleagues' appointments. Implemented as a broad `appt_select` (read at
accessible stores) OR'd with `appt_modify` (FOR ALL) gated on
`can_manage_store(...) OR staff_id = current_staff_id()`. Front desk / manager /
owner manage any appointment at their stores.

## ADR-003 · RLS helpers are SECURITY DEFINER
Membership lookups (org, role, store set) run inside SECURITY DEFINER functions so
they bypass RLS and avoid the classic recursive-policy problem (a policy on `staff`
that queries `staff`). `search_path` is pinned. This keeps policies simple and fast.

## ADR-002 · Clients are org-level, not store-scoped
A client's record and history should follow them across locations (book at Lehi,
visit Layton next time). So `clients` carries `org_id` only — no `store_id`. Every
operational table that records activity (`appointments`, `sales`) still carries
`store_id`, so "where did this happen" is preserved on the event, not the person.
Trade-off: by default every role in the org can read every client. Flagged as a
one-policy tightening if stylists should only see clients they've served.

## ADR-001 · `organizations` is the tenant boundary, above `stores`
Considered making `store` the top-level tenant. Rejected: it would block a single
owner from running multiple locations under one account, and would prevent a future
SaaS direction. An `organizations` table costs one extra FK now and keeps both
futures open. RLS isolates on org membership; store-level scoping happens within.
