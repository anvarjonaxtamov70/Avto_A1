# Main script authoring sections

These ordered fragments are not standalone JavaScript modules. They preserve shared scope, hoisting and execution order. Edit the relevant fragment, then run `node .github/sync-main-js.js --write` followed by `node .github/sync-all-js.js --write` from the repository root. Commit both generated copies. CI verifies exact equality. Do not reorder fragments without dependency analysis.
