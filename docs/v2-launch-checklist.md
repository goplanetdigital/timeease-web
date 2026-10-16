# TimeEase V2 launch gate

Keep checkout disabled until all checks pass.

- [ ] Merge main changes without losing existing product pages.
- [ ] Deploy V2 worker routes to production.
- [ ] Configure a 32+ character worker secret in Vercel and n8n securely.
- [ ] Verify private paid-job manifest and source access.
- [ ] Connect n8n XLSX conversion and Gmail delivery.
- [ ] Register Shopify ORDERS_PAID webhook to production HTTPS endpoint.
- [ ] Verify signature, order binding, amount and shop domain.
- [ ] Run a controlled paid end-to-end order and confirm email attachment.
- [ ] Confirm order transitions to DELIVERED only after successful send.
- [ ] Enable checkout gates only after passing the checks above.
