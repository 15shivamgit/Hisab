# Non-Functional Requirements

Status: Approved · Last updated: 2026-10-21

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Offline | Every feature works in airplane mode. The app performs no network requests. |
| NFR-02 | Privacy | No analytics, telemetry, crash reporting, ads, or remote config. Data never leaves the phone except when the user explicitly exports, backs up, or shares. |
| NFR-03 | Cost | ₹0. See [../00-overview/ZERO_COST_POLICY.md](../00-overview/ZERO_COST_POLICY.md). |
| NFR-04 | Platform | Android only. **Minimum Android 8.0 (API 26)**, target the SDK's default `targetSdkVersion` (36). Verified in Phase 10: Expo's docs list SDK 58 as "Android 7+", but on an Android 7.0 emulator both release and debug builds crash at start (Expo modules use `java.nio.file` and `java.time`, which exist from Android 8). Owner decision 2026-10-30: minSdk 26 via `plugins/withMinSdk.js`, so Android 7 phones are refused at install instead of crashing. |
| NFR-05 | Performance | Cold start to usable dashboard < 2 s on a mid-range phone with 5,000 transactions. Transaction list scrolls smoothly (FlatList with pagination of 50; FlashList only if profiling shows a need and the owner approves the dependency). Dashboard queries < 100 ms with 5,000 transactions. |
| NFR-06 | Data integrity | Foreign keys ON; all multi-step writes in a single DB transaction; no stored derived balances; backup/restore never leaves partial state. |
| NFR-07 | Durability | Data persists across app restarts, force-stops, and phone reboots. Receipts remain viewable after restart. |
| NFR-08 | Storage | Receipts are compressed (≈150–400 KB each). App checks free space before saving receipts and creating backups. |
| NFR-09 | Accessibility | Touch targets ≥ 48 dp; all icons/buttons have accessibility labels; supports system font scaling up to 200% without clipped text; text contrast ≥ 4.5:1; colour is never the only signal (gave/got also use icons and words). |
| NFR-10 | Usability | Forms usable on 5" screens with the keyboard open; primary action always reachable; amount field auto-focused with numeric keypad. |
| NFR-11 | Theming | Light and dark themes; follows system by default. |
| NFR-12 | Security | Optional app lock; content hidden in app switcher when lock is enabled; backup and restore inputs are validated as untrusted. See [../02-architecture/SECURITY_AND_PRIVACY.md](../02-architecture/SECURITY_AND_PRIVACY.md). |
| NFR-13 | Maintainability | TypeScript strict; ESLint + Prettier clean; no SQL outside `src/db`; business logic in pure functions with unit tests. |
| NFR-14 | Testability | Repositories testable in Node via the `DbClient` interface; financial logic covered by the cases in FINANCIAL_TEST_CASES.md. |
| NFR-15 | Localisation readiness | All user-facing strings in `src/content/`; dates and money formatted via helpers using `en-IN`. |
| NFR-16 | Separate installs | Each installation keeps its own data. Documented to friends; no feature implies otherwise. |
