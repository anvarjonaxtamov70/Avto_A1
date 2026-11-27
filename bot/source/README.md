# Bot and AI authoring sections

Ordered source fragments preserve Python scope and handler registration order. They are not importable modules. Edit fragments, run `node .github/sync-bot.js --write` from repository root, and commit generated Python files. CI checks byte equality. Existing runtime entrypoints remain unchanged.
