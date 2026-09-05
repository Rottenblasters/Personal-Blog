# How We Implemented Delta Bundle Pushes at Myntra

Over-The-Air (OTA) updates, commonly known as Bundle Pushes, are the secret sauce of modern hybrid mobile engineering. In a React Native application like Myntra, the app architecture is split into two distinct layers:

1. **The Native Shell:** The C++, Java, and Kotlin code compiled into the APK/AAB binary that handles OS interactions, hardware interfaces, and core rendering engines.
2. **The JavaScript Bundle:** A single compiled file (`index.android.bundle`, `index.ios.bundle`) containing all business logic, UI components, styling, and navigation flows.

Because the JavaScript engine ([Hermes](https://hermesengine.dev/)) executes code loaded from a disk file path, developers can update the JS bundle remotely via CDN. This bypasses the days-long App Store and Google Play review cycles as well as customer app adoption delays, allowing teams to push critical bug fixes, UI updates, and feature rollouts instantly to millions of devices.

## The Legacy Approach: Monolithic Full-Bundle Downloads

Historically, Myntra’s bundle push infrastructure operated on a simple full-download model. Whenever an engineer released an OTA update, every user device fetched the entire compiled JavaScript bundle from our CDN.

```text
[ Legacy Full-Download Flow ]

Client Handshake ──► CDN Request ──► Download Monolithic Bundle (20MB+) ──► Disk Write & Reload
```

While conceptually straightforward, this architecture hit a wall as the Myntra platform scaled.

### The Flaws of the Full-Download Approach

- **Bandwidth Overhead & Network Drop-Offs:** A production React Native bundle for a feature-rich e-commerce app easily reaches 15 MB to 25 MB. In regions with flaky cellular connections, requiring a 20 MB download for a 50 KB bug fix led to high download failure rates, timeouts, and canceled transfers.
- **Delayed Adoption Rates:** Because users on weak networks couldn't complete the download in a single session, it took days—sometimes weeks—for critical patches to reach the majority of active users.

## The Solution: Patch Updates

Changing a UI button color, adjusting business logic, or fixing a bug alters less than 1% of the underlying byte code.

Instead of downloading the entire 20 MB file, we implemented **Delta Updates**. The client app sends its currently installed bundle version signature, downloads a tiny binary diff (~100 KB to 300 KB), and reconstructs the new bundle locally on the device.

```text
Target Bundle (V2) = NativePatchEngine(Base Bundle (V1), Patch File (Δ 1→2))
```

```text
[ Delta Update Flow ]

Client Handshake (Sends V1 Hash)
        │
        ▼
CDN Returns Patch Δ1→2 (~150KB)
        │
        ▼
Native Stream Reconstruction
        │
        ▼
Verify V2 ──► Pointer Swap
```

## How We Implemented Delta Updates at Scale

### 1. Server-Side Diff Generation (CI/CD Pipeline)

Whenever a new bundle (`V2`) is compiled during our deployment pipeline:

- The automated pipeline fetches the base bundle (`V1`) of the current live production release.
- A binary diffing tool (using algorithms like [BSDiff](https://www.daemonology.net/bsdiff/)) compares `V1` against `V2` to isolate the modified byte blocks.
- The system compresses and uploads a targeted patch file (`Δ 1→2`) along with the expected SHA-256 hash of `V2` to our CDN.

### 2. The Smart Client-Server Handshake

When the Myntra app boots, its native client module sends a lightweight query to the update server containing its current environmental state:

```json
{
  "native_app_version": "4.28.0",
  "active_bundle_hash": "a1b2c3d4e5f6...",
  "platform": "android"
}
```

The server inspects `active_bundle_hash`:

- **Direct Patch Available:** If the server holds a patch matching `a1b2c3d4e5f6...` → `V2`, it returns the patch download URL (~150 KB).
- **Missing/Corrupt Base:** If the device is on an ancient or unrecognized version, the server falls back smoothly, returning the full `V2` download URL.

### 3. Native Reconstruction via Memory-Safe Streaming

Downloading a 150 KB patch file takes less than a second, but applying that patch to a 20 MB base file on disk presents a performance challenge: low-end Android devices can easily crash with Out-Of-Memory (OOM) errors if full files are loaded directly into RAM.

To solve this, our native Android patching module uses C++ wrapped in Kotlin to process files as byte streams:

```text
[ Base File Stream ] ──┐
                       ├──► [ Native Patch Engine ] ──► [ New V2 Output File Stream ]
[ Patch File Stream ] ─┘
```

The engine reads `V1` and `Δ 1→2` sequentially from internal app storage (`/data/data/com.myntra.android/files/bundles/`), stitches the new bytes together block by block, and writes the output directly to a temporary `V2` location—keeping memory allocation under a few megabytes.

### 4. Cryptographic Verification & Pointer Swapping

Before activating the newly generated `V2` file, the native container computes its SHA-256 checksum and compares it against the expected hash provided by the server.

If the checksum matches down to the exact byte:

1. **Pointer Flip:** The native initialization manager updates an internal key inside [`SharedPreferences`](https://developer.android.com/reference/android/content/SharedPreferences) pointing to the directory path of `V2`.
2. **Context Reload:** On the next app cold launch (or background resume), React Native's `ReactInstanceManager` reads the updated path and instantiates the JS engine directly from `V2`.

If the checksum fails (due to patch corruption or disk read errors), the app discards the bad file, logs telemetry, and requests a full bundle download as a safety net.

## Rollback Protection & Disk Garbage Collection

Modifying core app code on the fly requires fail-safe guardrails:

- **Two-Phase Commit Rollback:** When `V2` is first loaded, it is flagged as `PENDING_VERIFICATION`. If the JS engine encounters an unhandled runtime crash during boot, the native container intercepts the failure, marks `V2` as `CORRUPTED`, reverts the `SharedPreferences` pointer back to `V1` (or the stock factory bundle baked into the APK), and restores the app seamlessly.
- **Storage Pruning:** To prevent old updates from filling up device storage, a background garbage collection task runs after a successful launch, deleting obsolete bundle versions (`V1`) while keeping the immutable APK base intact.

## Results

By shifting from monolithic downloads to delta patch updates:

- **Payload sizes dropped by over 90%** (from ~20 MB down to ~150 KB for routine updates).
- **OTA update adoption skyrocketed**, with critical bug fixes reaching the vast majority of our active user base within hours instead of days.
