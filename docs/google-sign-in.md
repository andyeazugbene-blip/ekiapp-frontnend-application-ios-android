# Google Sign-In

Google Sign-In uses **two different implementations per platform**, implemented
in [`components/auth/SocialAuthButtons.tsx`](../components/auth/SocialAuthButtons.tsx).
Both produce the same thing — a Google ID token — and send it to the same
backend endpoint, so everything after that point (login vs. signup, session
creation) is identical regardless of platform.

| Platform | Implementation | Library |
|---|---|---|
| iOS | Browser-based OAuth (authorization code + PKCE) | `expo-auth-session` |
| Android | Native sign-in picker (Play Services) | `@react-native-google-signin/google-signin` (legacy native Google Sign-In SDK — **not** Credential Manager; see below) |

## Why two implementations

Google has removed support for the custom-URI-scheme browser redirect that
`expo-auth-session`'s Google provider uses for native/installed apps:

> "Custom URI schemes are no longer supported on Android and Chrome apps."
> — [developers.google.com/identity/protocols/oauth2/native-app](https://developers.google.com/identity/protocols/oauth2/native-app)

iOS is unaffected — that document is literally titled *"OAuth 2.0 for iOS &
Desktop Apps"* and that flow still works there. On Android, the identical
request (same client ID, same correct package name, same correct Play App
Signing SHA-1) was unconditionally rejected by Google's authorization server
with `Error 400: invalid_request` / *"Custom URI scheme is not enabled for
your Android client."* No app-side configuration fixes this; it's a platform
policy, not a bug. Confirmed by reproducing the exact request independently
of any device and reading Google's own error detail panel.

## Android: native Google Sign-In

`@react-native-google-signin/google-signin` wraps Android's native, Play
Services-backed sign-in UI — there is no browser involved and no redirect
URI at all, so the custom-URI-scheme restriction above doesn't apply to it.

**Important:** the free version of this package (what's installed here) uses
the **legacy native Google Sign-In SDK**, not the newer Credential Manager
API — true Credential Manager support is only in the maintainers' separate
paid "Universal Sign In" product. The legacy SDK is still a fully native,
Play-Services-driven flow (no browser, no custom scheme), so it's still the
correct fix for this bug; it just isn't literally Credential Manager.

Configuration (`SocialAuthButtons.tsx`, `configureAndroidGoogleSignIn()`):

```ts
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
```

It is configured with the **Web** OAuth client ID
(`202125496514-rl2h7vft68ggk20bla444a1f1bpdjv7a.apps.googleusercontent.com`,
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), **not** the Android-type client ID. The
Android-type client (`...tem3lnl161j203m0hi6eg8k2e9n3rp87...`) that produced
the broken redirect is no longer used anywhere in the app — passing a
`webClientId` to `GoogleSignin.configure()` is what makes the native SDK
request an ID token audienced for that web client, for exactly this reason
(so a single backend can verify tokens from any platform the same way).

`@react-native-google-signin/google-signin` is excluded from iOS entirely —
see [`react-native.config.js`](../react-native.config.js). Without that,
React Native's CocoaPods autolinking would still link the package's iOS
native module into every iOS build (that's independent of whether its Expo
config plugin is applied), even though the JS never calls it there. The iOS
build is unaffected by this package being installed.

## iOS: expo-auth-session (unchanged)

`Google.useAuthRequest({ iosClientId, androidClientId, webClientId })` from
`expo-auth-session/providers/google`, using `iosClientId`
(`202125496514-alrducvlk3ia17u9mscp2emv6umala4i.apps.googleusercontent.com`).
This is exactly what shipped before this fix — untouched.

## Backend

Both platforms send their ID token to the same endpoint:

```
POST /api/auth/oauth/google
```

(`ekiapp-backend-main`'s `oauth.controller.ts` → `verifyGoogleIdToken()`).
No backend change was needed for this fix: `verifyGoogleIdToken`'s
`allowedAudiences` already included the Web client ID (`env.googleClientIds`
= iOS + Android + Web client IDs, all accepted as valid token audiences) —
Android tokens now simply arrive with `aud` = the Web client instead of the
Android client, the same as a token from the web dashboard would.

## Google Cloud configuration required

- **Web OAuth client** (`...rl2h7vft68ggk20bla444a1f1bpdjv7a...`): already
  exists, already used — no change needed.
- **Android OAuth client** (`...tem3lnl161j203m0hi6eg8k2e9n3rp87...`): still
  exists in Google Cloud Console but is **no longer used** by the app. Left
  in place rather than deleted, in case anything else still references it.
- No new OAuth client was created for this fix.
