# How Myntra Dynamically Swaps App Icons and Splash Screens On-the-Fly for Mega Sales

During High Revenue Days (HRD)—Myntra’s sales events—marketing visibility is everything. While push notifications, social ads, and performance marketing drive traffic, one of the most valuable pieces of digital real estate remains underutilized: the user’s home screen and app boot experience.

Changing our app icon and splash screen to reflect an ongoing sale creates immediate organic awareness. However, relying on standard App Store or Play Store app updates to change the icon and splash screen for temporary events is a non-starter because update adoption is too slow, and sales are time-sensitive. We needed a reliable way to update our icon and splash experience dynamically, on-the-fly, without forcing a new app release.

## The Strategy: Remote Config + Pre-Bundled Assets

Because mobile operating systems enforce security limits on executable assets, we cannot download executable system icon assets off the wire at runtime.

Our solution was a hybrid approach:

1. **Pre-bundle** a small set of icon variants (3–4 event designs) in standard releases ahead of major shopping events. This incurs a negligible impact on app binary size.
2. **Control activation remotely** using Switch, Myntra’s internal key-value configuration service.

At Myntra, when a user opens the app, an expedited network call fetches the latest configuration payload from Switch and caches it locally.

```json
{
  "app_icon_name": "icon_hrd_sale",
  "splash_animation_url": "https://assets.myntra.com/splash/hrd_lottie.json"
}
```

Once cached, the app evaluates whether an icon or splash transition is required.

## iOS Implementation: Native Dynamic Icons

Apple provides official native support for programmatic icon changes via [`setAlternateIconName(_:completionHandler:)`](https://developer.apple.com/documentation/uikit/uiapplication/setalternateiconname(_:completionhandler:)).

- **Configuration:** Alternate icon names are declared in `Info.plist` under `CFBundleIcons` → `CFBundleAlternateIcons`.
- **Execution:** We invoke the native API:

```swift
UIApplication.shared.setAlternateIconName("icon_hrd_sale")
```

- **Lifecycle Management:** To prevent disrupting active shopping sessions with OS-level alerts or visual glitches, the change is deferred until the app enters the background by listening to `UIApplication.didEnterBackgroundNotification`.

## Android Implementation: The Activity-Alias Workaround

Android does not offer an explicit API to change launcher icons dynamically. To achieve this, we leverage Activity Aliases.

### 1. Manifest Declarations

We define multiple `<activity-alias>` elements in `AndroidManifest.xml`, each pointing to our main entry `MainActivity`. Each alias carries its own distinct icon asset and launcher intent filter.

```xml
<activity-alias
    android:name=".LauncherDefault"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher_default"
    android:targetActivity=".MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity-alias>

<activity-alias
    android:name=".LauncherHRDSale"
    android:enabled="false"
    android:icon="@mipmap/ic_launcher_hrd"
    android:targetActivity=".MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity-alias>
```

### 2. Toggling the Active Icon

When Switch flags an active event, we enable the target alias and disable the current one using Android's `PackageManager`.

```kotlin
fun updateAppIcon(context: Context, activeAlias: String, inactiveAlias: String) {
    val pm = context.packageManager

    // Enable Sale Icon Alias
    pm.setComponentEnabledSetting(
        ComponentName(context, activeAlias),
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP
    )

    // Disable Default Icon Alias
    pm.setComponentEnabledSetting(
        ComponentName(context, inactiveAlias),
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
        PackageManager.DONT_KILL_APP
    )
}
```

### 3. Engineering Challenges & Edge Cases

While iOS handles dynamic icon swaps cleanly, Android introduced significant runtime hurdles during our initial rollout.

#### Issue A: Process Termination & Sensitive App Backgrounding

Unlike iOS, when you disable an active `<activity-alias>` component on Android via `PackageManager`, the OS forcibly kills the application process—even when passing the `PackageManager.DONT_KILL_APP` flag on many OEM devices.

If an app process dies unexpectedly, it wrecks the user experience. One way to avoid this is to trigger the app icon change when the app goes into the background, but on Android, an app goes into the background for many routine reasons:

- The user receives an incoming phone call.
- A system dialog pops up (e.g., location/camera permissions).
- **The Payment Flow:** A user toggles to a third-party bank app, UPI gateway, or 2FA SMS screen during checkout.

If the icon swap triggers while the user is authenticating a payment, killing the app process instantly drops the checkout transaction.

**The Fix:**

1. **Lifecycle Tracking (`ProcessLifecycleOwner`):** We register an observer on Android’s `ProcessLifecycleOwner` to listen for the app-wide `ON_STOP` event (when the entire application goes to the background) rather than individual activity states.
2. **Route Safety Guardrails:** Before executing the alias toggle inside `ON_STOP`, we check the current navigation route. If the user is on sensitive, high-intent screens—such as `/checkout`, `/payment_gateway`, or `/otp_verification`—we suspend the icon swap execution entirely until a safer session boundary.

#### Issue B: Deep Links & Affiliate Intent Resolution Failures

Affiliate marketing campaigns rely on deep links managed by platforms like AppsFlyer, Branch, or Firebase Dynamic Links. These affiliate links do not directly contain the destination path. Instead, they open the app with an encoded payload. Once launched, the app uses the embedded attribution SDK to decode the payload, resolve the underlying Myntra URL (e.g., a specific Product Display Page or Sale Category), and trigger internal route navigation.

When we introduced Activity Aliases, this decoding and routing flow broke in two ways:

1. **Disabled Intent Filters:** If deep link `<intent-filter>` declarations were attached only to `.LauncherDefault` in `AndroidManifest.xml`, disabling `.LauncherDefault` during a sale event simultaneously disabled those intent filters. Incoming affiliate links failed to launch the app entirely, falling back to browsers.
2. **Explicit Intent Mismatches:** Once the third-party attribution SDK decoded the wrapped URL, it attempted to open the deeplink by firing an Intent with the target `ComponentName` hardcoded to `.LauncherDefault`. Because that component was now disabled in favor of `.LauncherHRDSale`, the system threw an `ActivityNotFoundException` or silently dropped the navigation callback.

**The Fix:**

- **Mirroring Intent Filters:** We declared all deep-link and App Link `<intent-filter>` schemes across every `<activity-alias>` in `AndroidManifest.xml`. This ensures the OS routes incoming links to whichever launcher alias is currently active.
- **Dynamic Active Component Resolution:** We updated our deep link handling bridge to dynamically resolve the active activity component before handing off the decoded URL payload to internal router engines.

## Dynamic Splash Screens: Lightweight Lottie Vectors

Unlike launcher icons, splash screen assets do not require pre-registration with the OS manifest. We also did **not** rely on Android’s system Splash Screen API or iOS launch-storyboard swaps for the event experience. On both platforms we owned a custom root view that hosts two children in the launch hierarchy:

1. An **animation / splash view** for the event-branded boot experience
   - **Android:** a [Lottie](https://airbnb.io/lottie/) [`LottieAnimationView`](https://github.com/airbnb/lottie-android) ([lottie-android](https://github.com/airbnb/lottie-android))
   - **iOS:** a [Lottie](https://airbnb.io/lottie/) animation view from [lottie-ios](https://github.com/airbnb/lottie-ios) layered in a native `UIView` hierarchy
2. A **React view container** that holds the main React Native surface
   - **Android:** the React root hosted by `ReactActivity`
   - **iOS:** the React Native root view (e.g. `RCTRootView` / RN host view) embedded as a sibling under the same parent

- **Remote Vector Payload:** The Switch JSON config delivers a direct URL pointing to a lightweight Lottie animation file hosted on our CDN. The animation is cached locally so cold start can play it without waiting on the network.
- **View Handoff on Boot (Android & iOS):** When the root view is created, the splash animation view is shown/enabled and the React container is hidden. While the animation plays, React Native initialization (JS runtime bring-up and API prefetches) continues in the background. Once **both** conditions are met—the splash animation has completed **and** React is ready—we hide the animation view and make the React view visible, handing the user into the live app without a hard cut or an extra app update.

