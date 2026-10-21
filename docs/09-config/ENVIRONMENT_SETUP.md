# Environment Setup (Windows 11)

Status: Approved (`Verify:` versions in Phase 2) · Last updated: 2026-10-21

Everything here is free.

## Status on the owner's machine (checked 2026-10-21)

| Tool | Status |
|---|---|
| Node.js | v24.20.0, npm 11.19.0 — works for all Phase 2 tooling (install, typecheck, lint, test, export, prebuild) |
| Git | 2.55.0 |
| GitHub CLI | Logged in as `shivam-quark` (active) and `15shivamgit`; see WORKFLOW.md for pushing as `15shivamgit` |
| Android Studio / SDK / JDK | **Not installed** — needed for dev builds, emulator, and APKs |

## Install

| Tool | Notes |
|---|---|
| Node.js LTS | Node 24 verified with Expo SDK 58 tooling (see above) |
| Git for Windows | Then: `git config --global core.longpaths true` |
| VS Code | Extensions: ESLint, Prettier |
| Android Studio | Install: Android SDK Platform (SDK's target API), SDK Build-Tools, Platform-Tools, Android Emulator, one system image (e.g. a Pixel with Google APIs) |
| JDK | Use the JDK bundled with Android Studio (`jbr`) unless the SDK requires another version. `Verify:` required JDK version |
| Maestro CLI | Phase 10. `Verify:` current Windows installation method |

## Environment variables (PowerShell, user scope)

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
# Add to PATH: %ANDROID_HOME%\platform-tools  and  %ANDROID_HOME%\emulator
```

Open a new terminal, then check: `adb version`, `java -version`, `node -v`.

## Windows long paths

Gradle builds can fail with long paths. Keep the project at `d:\Code\hisaab`. If errors mention path length, enable Windows long paths (admin PowerShell):

```powershell
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
```

## Phone

1. Settings → About phone → tap **Build number** 7 times → Developer options on.
2. Developer options → **USB debugging** on.
3. Connect USB → accept the RSA prompt → `adb devices` shows the phone.

## Daily commands (after Phase 2)

| Task | Command |
|---|---|
| Build + install dev build on phone/emulator | `npm run android` (`expo run:android`) |
| Start Metro for the installed dev build | `npm start` (`expo start --dev-client`) |
| Format code | `npm run format` |
| Check SDK compatibility | `npx expo-doctor` · `npx expo install --check` |
| Add a package | `npx expo install <pkg>`; dev tools: `npx expo install <pkg> "--" --dev` (quote the `--` in PowerShell) |
| Typecheck / lint / test | `npm run typecheck` · `npm run lint` · `npm test` |
| Install an APK | `adb install -r path\to\app.apk` |
| See device logs | `adb logcat *:E ReactNativeJS:V` |

## Dev vs real data

The dev build uses a different application ID (`…hisaab.dev`, name "Hisaab Dev"), so it installs **next to** the real release app. The owner's real data in the release app is never touched by development. See [APP_CONFIG.md](APP_CONFIG.md).
