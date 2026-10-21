# Zero-Cost Policy

Status: Approved · Last updated: 2026-10-21

Hisaab must cost **₹0** to develop, run, and distribute to the owner and friends.

## Allowed (free)

| Item | Cost | Notes |
|---|---|---|
| Expo SDK, React Native, all npm libraries used | ₹0 | Open-source (MIT/Apache/BSD). Licence checked before adding. |
| Android Studio, JDK, Android SDK, emulator | ₹0 | For local development and local release builds |
| Node.js, Git, VS Code | ₹0 | |
| EAS Build **Free plan** | ₹0 | Optional cloud builds. `Verify:` current monthly build limit and queue times on the Free plan. Never enter card details. |
| GitHub (private repo) | ₹0 | Optional source backup. GitHub Actions free minutes are optional; not required. |
| Maestro CLI | ₹0 | Local E2E tests. Do **not** use Maestro Cloud (paid). |
| APK sharing | ₹0 | Google Drive link, WhatsApp document, USB cable |
| Privacy policy hosting (only if Play Store later) | ₹0 | GitHub Pages |

## Not allowed

- Any backend, cloud database, or hosted API.
- Paid APIs (OCR, SMS gateways, push services).
- Analytics, crash reporting, or ad SDKs (also violate the offline/privacy rules).
- Paid tiers of any tool, trial plans that need a card, or "free until X users" services.

## The one known cost (deferred)

| Item | Cost | Status |
|---|---|---|
| Google Play Console developer registration | US$25 one-time | **Deferred / optional.** Only if the owner later decides to publish publicly. See [../09-config/BUILD_AND_RELEASE.md](../09-config/BUILD_AND_RELEASE.md#optional-future-play-store). |

## Rule for agents

Before suggesting any tool or service, confirm it is free for this use with no card required. If unsure, ask the owner.
