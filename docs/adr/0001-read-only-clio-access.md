# 0001: Read-only access to Clio

**Status:** accepted

The app only reads from Clio. `clioGet()` is the single function that calls Clio and it issues GET only. The Clio app is registered with Read scopes only.

**Why:** A case file is a legal record. A bug, or a model mistake, must never be able to change it. It also makes the app easy for a firm to approve.

**Consequence:** Test data cannot be created in Clio by the app. Use `npm run seed` or the demo case.
