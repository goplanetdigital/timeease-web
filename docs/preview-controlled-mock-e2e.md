# Remaining controlled Preview delivery acceptance

Only the fixed synthetic ID a1d26449-c4b5-4668-bffb-746ad257e708 is added to the
existing protected Preview adapter. Recipient: mock-inbox@example.invalid.
Shopify binding: preview-pr20-mock-20261108:<id>, shop preview.invalid, amount USD1
synthetic only. The operator seeds one new PAID row; the app cannot insert orders.
No old fixture or terminal order may be reset or replayed.

The existing prepare/claim/result/Outbox modules are reused. For this exact mock
case only, outbox_claim returns the durable delivery UUID/lease and a
mockProviderOnly marker. send=true authorizes only the simulated provider to the
fixed .invalid inbox. No provider integration or customer email path is added.
The existing main n8n Draft no-mail hard stop stays unchanged.

mock_receipt accepts only this case, exact ledger delivery UUID, and a deterministic
synthetic SHA256 receipt for mock-provider:<delivery UUID>. It uses the same
completeV2Outbox transaction as formal delivery. The n8n test records one mock
inbox item in its retained execution; no Gmail/SMTP/real-provider node is present.
The XLSX is generated in n8n, uploaded/read back in the isolated Blob store, then
published/claimed/completed using real Preview database transitions.

This is mock-provider E2E evidence. It does not prove Gmail/Live provider receipt
authenticity or Production connectivity. No customer mail, real payment,
Production Worker, merge, cleanup or Production mutation is allowed.

CI runs only two newly added mock boundary tests. Previous signature/TLS/Outbox/
race/receipt suites are reused, not rerun. Exact-source guards remain on the
unchanged Outbox/claim/formal-delivery/payment/release modules. Changes to the
Preview adapter and fixed fixture helper are reviewed as a diff restricted to
this one additional case; old branches are retained.

After successful E2E, retain DELIVERED and its SENT ledger/receipt. Disable the
manual acceptance trigger. Roll back the adapter commit if needed, preserving
all audit rows and files. Never delete or reset a delivered fixture to rerun it.
