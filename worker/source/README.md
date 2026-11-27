# Worker source sections

Ordered fragments preserve the existing Worker scope and execution order. They are not standalone modules. Edit fragments and run `node .github/sync-worker.js --write`, then commit the generated cloudflare-worker.js. CI checks exact equality. Deployment entrypoint is unchanged.
