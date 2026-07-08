# Reports catalog

Every report from the Mangomint reporting suite, mapped to its data source and
the view that powers it. **A report = one SQL view** (`security_invoker`, so it's
auto-scoped to the caller's org/store/role). The frontend just selects from the view.

**All 40 reports are live** across `07_reports.sql` (wave 1) and
`08_reports_wave2.sql` (wave 2) — 42 `rpt_*` views total. Validated on Postgres 16:
every view queries cleanly and inherits RLS per caller.

## STAFF
| Report | View |
|---|---|
| Service & Product Sales By Staff | `rpt_staff_sales` |
| Time Clock | `rpt_time_clock` |
| Days Off | `rpt_days_off` |

## SALES
| Report | View |
|---|---|
| Sales Summary | `rpt_sales_summary` |
| Service Sales | `rpt_service_sales` |
| Product Sales | `rpt_product_sales` |
| Sales by Time Period | `rpt_sales_by_period` |

## REFUNDS
| Report | View |
|---|---|
| Refund Summary | `rpt_refund_summary` |
| Refund Details | `rpt_refund_details` |

## OFFERS
| Report | View |
|---|---|
| Offers Usage | `rpt_offers_usage` |
| Offers Summary | `rpt_offers_summary` |

## CLIENT ACCOUNT BALANCES
| Report | View |
|---|---|
| Client Account Usage | `rpt_client_account_usage` |
| Client Account Balances | `rpt_client_account_balances` |
| Client Account Deposits | `rpt_client_account_deposits` |

## GIFT CARDS
| Report | View |
|---|---|
| Gift Card Usage | `rpt_gift_card_usage` |
| Gift Card Balances | `rpt_gift_card_balances` |
| Gift Card Sales | `rpt_gift_card_sales` |
| Gift Card Sales Details | `rpt_gift_card_sales_details` |

## PACKAGES
| Report | View |
|---|---|
| Package Usage | `rpt_package_usage` |
| Outstanding Packages | `rpt_outstanding_packages` |
| Package Sales | `rpt_package_sales` |
| Package Sales Details | `rpt_package_sales_details` |

## MEMBERSHIPS
| Report | View |
|---|---|
| Membership Payments | `rpt_membership_payments` |
| Membership Credit Usage | `rpt_membership_credit_usage` |
| Memberships Started | `rpt_memberships_started` |
| Memberships Cancellations | `rpt_membership_cancellations` |

## PAYMENTS
| Report | View |
|---|---|
| Payment Summary | `rpt_payment_summary` |
| Payment Details | `rpt_payment_details` |
| Cash Drawer Activity | `rpt_cash_drawer_activity` |
| Deposits Collected | `rpt_deposits_collected` |
| Deposits Used | `rpt_deposits_used` |

## INVENTORY
| Report | View |
|---|---|
| Cost of Goods | `rpt_cost_of_goods` |
| Product Inventory | `rpt_product_inventory` |
| Product Inventory Changes | `rpt_inventory_changes` |
| Product Stock & Usage | `rpt_product_stock_usage` |

## BUSINESS
| Report | View |
|---|---|
| Cashflow | `rpt_cashflow` |
| Business Intelligence: Appointments | `rpt_bi_appointments` |
| Business Intelligence: Sales | `rpt_bi_sales` |
| Business Intelligence: Forecast | `rpt_bi_forecast` |
| Client Retention | `rpt_client_retention` |
| Appointment Cancellations | `rpt_appointment_cancellations` |

## DATA EXPORT
| Report | View |
|---|---|
| Appointments | `rpt_export_appointments` |

---

### Notes
- Two supporting tables were added in wave 2: `package_redemptions` (drives Package
  Usage) and `membership_credits` (drives Membership Credit Usage). `bi_forecast`
  is derived — recent daily-average payments × 7 plus the booked-but-unpaid pipeline.
- Views return **integer cents**; format to currency in the client.
- Because every view uses `security_invoker`, the same report definition serves
  every role — owner (all stores), manager, front desk, stylist (their stores only).
- **Frontend next:** a Reports section grouped exactly like the source menu, each
  item rendering its view as a table + chart. Pure read-only selects.
