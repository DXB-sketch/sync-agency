# Publishing the Sync Agency app (Google Play + Apple App Store)

The web app is wrapped with [Capacitor](https://capacitorjs.com). Two native projects live in this repo:

- **`android/`** — Android Studio project → Google Play
- **`ios/`** — Xcode project → Apple App Store (opening/building it requires a Mac)

The app bundles the built web app (`dist/`) and talks to the same Supabase backend as the live site.
App identity: **`org.syncagency.app`**, display name **Sync Agency** (change both in `capacitor.config.json`, then run `npx cap sync`).

## Day-to-day workflow

```bash
npm run app:sync       # rebuild the web app and copy it into android/ and ios/
npm run app:android    # build + sync + open Android Studio
npm run app:ios        # build + sync + open Xcode (Mac only)
```

Icons/splash screens are already generated (from `resources/icon.png` / `resources/splash.png`).
To regenerate after changing the artwork: `npx @capacitor/assets generate --iconBackgroundColor '#080808' --splashBackgroundColor '#080808'`.

## What's already handled in the code

- **Account deletion in-app** (Apple 5.1.1(v) / Play "Account deletion" policy): Support tab → "Delete account", backed by the `delete-account` edge function which erases the member's data and auth user.
- **No digital purchases in the app** (Apple 3.1.1): course-upgrade purchase buttons (portal Upgrade page, marketing pricing CTAs, locked-slot upgrade buttons) are hidden automatically when running inside the native shell. Physical stock checkout via Stripe stays — that's allowed. Do not re-enable tier purchases in-app without implementing Apple IAP.
- **Free account works with no purchase** (Apple 2.1 reviewers must be able to use the app): reviewers can sign up free and see the full dashboard.
- **PWA/webapp**: `public/manifest.webmanifest` + icons, theme colour, and `viewport-fit=cover` are in place.

## Google Play checklist

1. Install Android Studio + JDK 17. Open `android/` (`npm run app:android`).
2. Create a **release keystore** and configure signing in `android/app/build.gradle` (or use Play App Signing).
3. Bump `versionCode` / `versionName` in `android/app/build.gradle` for every release.
4. Build → Generate Signed Bundle (`.aab`).
5. In [Play Console](https://play.google.com/console) ($25 one-off): create the app, upload the `.aab`.
6. Store listing needs: 512×512 icon (use `resources/icon.png` scaled), 1024×500 feature graphic, at least 2 phone screenshots, short + full description.
7. Complete the **Data safety** form (the app collects: email, name, shipping addresses of buyers, purchase history — shared with Stripe for payments).
8. Provide the **privacy policy URL** (host on syncagency.org — still to be written).
9. Content rating questionnaire, target audience (18+ recommended — it's a business/finance app), and the "Financial features" declaration (none — payments are for physical goods via Stripe).
10. Test track → production rollout.

## Apple App Store checklist (requires a Mac)

1. Enroll in the [Apple Developer Program](https://developer.apple.com) (US$99/yr).
2. On a Mac: `npm run app:ios`, then in Xcode set your Team under Signing & Capabilities.
3. Bump the version/build number in Xcode for every release.
4. Product → Archive → upload to App Store Connect.
5. App Store Connect listing: name, subtitle, description, keywords, support URL, marketing URL, 6.7" + 6.5" iPhone screenshots (iPad screenshots only if you enable iPad).
6. **App Privacy** section: declare collection of email, name, shipping addresses, purchase history; linked to identity; not used for tracking.
7. Privacy policy URL (same as Play).
8. Provide a **demo account** for review (a confirmed free account is enough) in the review notes, and mention: "Digital course upgrades are only sold on our website; the app sells physical stock fulfilment only."
9. Watch for guideline **4.2 minimum functionality**: if Apple pushes back that it's "a website in an app", the native push-notification integration below is the usual fix.

## Still to do before submitting (not code)

- [ ] Privacy Policy + Terms of Service pages hosted at syncagency.org and linked in both listings *(explicitly out of scope for now)*.
- [ ] Replace the placeholder Stripe keys/price IDs (see PORTAL_SETUP.md) — reviewers will exercise checkout.
- [ ] Screenshots + store copy.
- [ ] Developer accounts (Google $25 once, Apple $99/yr).
- [ ] Optional but recommended for Apple 4.2: add `@capacitor/push-notifications` (e.g. notify when an order ships or a ticket is answered) so the app offers native functionality beyond the website.
