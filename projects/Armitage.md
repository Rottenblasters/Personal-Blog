# How We Built a Doctor for Myntra's App — Measuring Every Heartbeat of Performance

*At Myntra, millions of users scroll through fashion every day. But how do you know if the app is smooth on a ₹10,000 phone in Tier-3 India? We built Armitage — a system that listens to the app's pulse in real time.*

---

Imagine you're a doctor. Your patient is an app used by millions. You can't ask the patient "how are you feeling?" — you need instruments. Heart rate monitors. Blood pressure cuffs. Oxygen sensors. You need them running quietly in the background, not slowing the patient down, and you need the readings to mean something — not just raw numbers, but an actual diagnosis.

That's the problem we set out to solve at Myntra.

## The Problem: Flying Blind on Performance

Every two weeks, our mobile team ships a new release. And every two weeks, the same question haunted us: *"Did we make the app faster or slower?"*

The honest answer was: we didn't really know.

Sure, we had tools. Xcode Instruments. Android Studio Profiler. They're powerful — and also painfully slow, crash-prone, and require a developer to sit there babysitting a USB-connected device. Want to measure FPS on the Product Detail Page across three devices? Clear your afternoon.

Worse, these tools only worked in a controlled lab setting. They told us nothing about what was happening on a real user's phone — a mid-range Samsung in Bangalore with 47 apps running and 2GB of free RAM.

We needed three things:

1. **Speed** — Measure performance in seconds, not hours.
2. **Reality** — Collect vitals from real user sessions, not just lab conditions.
3. **Intelligence** — Don't just give us numbers. Tell us if something is *wrong*.

So we built **Armitage**.

## What Armitage Measures (The Four Vitals)

Think of these as the app's vital signs:

**UI FPS (Frames Per Second)** — How smoothly the screen renders. When you scroll through a product listing page and it feels buttery, that's 60 FPS. When it stutters, FPS has dropped. This measures the *main thread* — the one responsible for drawing pixels on screen.

**JS FPS** — Myntra is a React Native app, which means a JavaScript thread runs the business logic while a native thread handles rendering. JS FPS measures how responsive that JavaScript thread is. If JS FPS drops, the app might *look* smooth for a moment but soon starts lagging — buttons stop responding, data stops loading. It's like a heart that's still beating but the brain is starving for oxygen.

**CPU Usage** — How much of the processor your app is consuming. High CPU means the phone heats up, the battery drains, and the OS might throttle your app. Think of it as measuring how hard the app is working.

**Memory** — How much RAM the app is using. Use too much, and the OS kills your app outright (an OOM crash). This is the vital sign that, when it spikes, the patient flatlines.

Beyond these four, Armitage also tracks **TTID** (Time to Initial Display — when the first frame appears) and **TTFD** (Time to Full Display — when the page is fully interactive), plus **Cold Launch Time** (the dreaded wait from tapping the icon to seeing the home screen).

## The Architecture: Kotlin Multiplatform at the Core

Here's where the engineering gets interesting.

We needed one system that works on both Android and iOS. Writing it twice was a non-starter — not just for development cost, but for *correctness*. If the Android and iOS implementations drift, your metrics become incomparable.

Enter **Kotlin Multiplatform (KMP)**.

The core brain of Armitage — scoring, anomaly detection, data storage, event generation — lives in shared Kotlin code that compiles to both platforms. But the actual *collection* of vitals has to be platform-specific, because you're reaching into the operating system's guts:

```
┌─────────────────────────────────────────────────┐
│              JS / React Native Layer             │
│  (initialization, navigation events, config)     │
└──────────────────────┬──────────────────────────┘
                       │ JSI (synchronous)
┌──────────────────────▼──────────────────────────┐
│           Platform Bridge (Android / iOS)         │
│  (FPS Invoker, CPU Invoker, Memory Invoker)      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│            KMP Shared Core (Kotlin)               │
│  (Scoring, Anomaly Detection, DB, Reporting)     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│          7 SQLite Databases (SqlDelight)          │
│  (JS FPS, UI FPS, Memory, CPU, Nav, App, Meta)   │
└─────────────────────────────────────────────────┘
```

Each layer has a clear job. The JS layer says *"the user just navigated to the Product Detail Page."* The native layer says *"okay, I'll start measuring."* The KMP core says *"here's what those measurements mean."*

## How We Collect Each Vital

### FPS: Riding the Display Refresh

On Android, we hook into React Native's `FpsDebugFrameCallback`, which itself sits on top of Android's `Choreographer` — the system component that fires once per display refresh. A handler samples FPS every 50 milliseconds. The same class serves both UI FPS and JS FPS by switching which counter it reads.

On iOS, we use `CADisplayLink` — Apple's equivalent of the Choreographer. For UI FPS, the display link runs on the main thread's RunLoop, reporting at 1-second intervals. For JS FPS, we do something clever: we dispatch the display link onto React Native's JS thread. If the JS thread is too busy to service the callback, FPS drops. This directly measures JS thread responsiveness without any approximation.

One subtle challenge: modern phones run at 90Hz or 120Hz, not just 60Hz. A phone reporting 90 FPS on a 120Hz display isn't performing as well as one reporting 60 FPS on a 60Hz display. So we **normalize everything to a 60Hz base**. This makes metrics comparable across the entire device spectrum — from an iPhone SE to an iPhone 15 Pro Max.

We benchmarked our FPS collection against Xcode Instruments and confirmed it's within **0.5% deviation** — accurate enough for production, with only ~1-2% CPU overhead at a 100ms sampling interval.

### CPU: Reading the Kernel's Diary

On Android, we read `/proc/{pid}/stat` every 200 milliseconds — a file the Linux kernel maintains with per-process CPU tick counts. We compute the delta between successive readings, normalize by the number of CPU cores, and derive user%, system%, and overall% utilization.

On iOS, we call `host_processor_info` with `PROCESSOR_CPU_LOAD_INFO` to get per-core load, then aggregate across all cores.

### Memory: Asking the OS How Much We're Eating

On Android, we sample every 800ms using `Debug.MemoryInfo` (for process-specific PSS — Proportional Set Size) and `ActivityManager.MemoryInfo` (for system-wide availability).

On iOS, we go straight to the Mach kernel via `task_info` with `TASK_VM_INFO`, reading `phys_footprint` — the definitive measure of how much physical memory the process has claimed. This runs every 100ms.

## The JSI Bridge: Why Milliseconds Matter

Here's a detail that might seem minor but is actually critical.

When a user navigates from the Home page to the Product Listing Page, we need to *start* collecting vitals the instant that page gains focus, and *stop* the instant it loses focus. If there's a 50ms delay in that signal, every data point in the session is 50ms misaligned — your "PDP performance" actually includes tail-end Home page data.

React Native's traditional bridge is asynchronous — messages go into a queue and get processed when the native side gets around to it. That's fine for most things, but not for performance instrumentation.

So we use **JSI (JavaScript Interface)** — a synchronous C++ binding that lets JavaScript call native code directly, with no queue, no serialization overhead. On Android, this is a C++ host object loaded via `ReLinker` and installed on `global.M2PersonalizationHost`. On iOS, it's an ObjC++ module that installs a `jsi::HostObject` on the runtime (with a fallback to the bridge if JSI setup fails).

The result: page focus/blur signals arrive with near-zero latency, and our vitals are precisely page-attributed.

## Smart Collection: Not Everything, Everywhere, All the Time

Collecting performance data has a cost — CPU cycles, memory, battery. We can't run all four vitals on every page for every user indefinitely.

Armitage is surgically targeted:

- **Route-based activation**: A remote config specifies which pages to track (Home, PDP, PLP, Search, etc.). Non-tracked pages are ignored entirely.
- **Focus/blur lifecycle**: Trackers only run while a tracked page is in the foreground. Navigate away? Trackers stop. Come back? They restart.
- **maxCount per route**: After a configurable number of visits to any given page, collection stops for that page. This bounds data volume in long sessions.
- **Staleness threshold**: Raw data older than a configurable window is automatically purged from the local databases.
- **Sampling via AB bucketing**: In production, only a controlled cohort of users has collection enabled, managed through our experimentation platform (Morpheus).

## Seven Databases, Not One

Here's a design decision that surprised even us.

Armitage uses **seven separate SQLite databases** — one each for JS FPS, UI FPS, Memory, CPU, Navigation, App Performance, and Metadata. Each follows the same pattern: a raw data table (timestamped readings) and a derived data table (computed aggregates).

Why not seven tables in one database?

Write contention. FPS data arrives every 50ms. Memory data every 100-800ms. CPU every 200ms. Navigation events are sporadic. If all these writers contend for a single database lock, you get exactly the kind of performance degradation you're trying to *measure*. Separate databases mean independent write locks and zero cross-vital interference.

We use **SqlDelight** for type-safe, multiplatform database access. Schema migrations use a `DestructiveSqlSchema` strategy — on version mismatch, the database is dropped and recreated. This is acceptable because vital data is ephemeral by design; the aggregated insights have already been reported upstream.

## Scoring: Not All Devices Are Created Equal

Raw metrics are necessary but not sufficient. Telling a PM *"FPS was 45 on this page"* raises the question: *"Is that good or bad?"*

It depends on the device.

Armitage classifies every device into a tier — **low, mid, or high** — using a weighted hardware benchmark:

| Factor  | Weight | How It's Measured |
|---------|--------|-------------------|
| CPU     | 33%    | Core count, clock speed, architecture |
| GPU     | 28%    | Metal/Vulkan family, feature level |
| RAM     | 22%    | Total memory, optional speed benchmark |
| Storage | 17%    | Capacity, optional I/O throughput |

A ₹10,000 phone and a ₹1,00,000 phone get different report cards. 45 FPS on a budget device might score 85/100 (excellent for that hardware). The same 45 FPS on a flagship scores 55/100 (something is wrong).

Each vital gets a 0-100 score relative to tier-specific targets from remote config. The per-page composite score is a weighted blend:

```
Page Score = w₁ × JS_FPS_Score + w₂ × UI_FPS_Score + w₃ × Memory_Score 
           + w₄ × CPU_Score + w₅ × TTFD_Score
```

Where the FPS composite itself is 60% JS FPS + 40% UI FPS — because in a React Native app, JS thread health is the leading indicator of user-perceived smoothness.

## Anomaly Detection: The Automated Diagnosis

Scores are useful. Alerts are actionable.

Armitage runs anomaly detection on every page session:

- **FPS Jank Detection**: Scans for contiguous periods where FPS drops below a threshold. Counts "jank episodes" (noticeable stutters) and "hang episodes" (severe freezes, typically below 10 FPS for extended durations).
- **CPU Anomaly**: Flags when more than 50% of samples in a session exceed 80% CPU utilization — a sign of runaway computation.
- **Cold Launch Anomaly**: Flags launches exceeding 3 seconds, with severity levels at 1×, 1.5×, and 2× the threshold.
- **Memory**: Tracks trajectory — a steadily climbing memory curve across sessions indicates a leak.

These anomalies fire events that flow to our dashboards and alerting infrastructure.

## The Feedback Loop: From Phone to Backend and Back

Armitage doesn't just observe — it closes the loop.

Every API request from the app carries an **`x-device-score` header** containing the device's hardware score and dynamic performance scores. The backend reads this header and can adjust what it sends — simpler layouts for struggling devices, richer experiences for capable ones.

This means the app's performance data actively shapes the user experience. A user on a low-end device in Jaipur doesn't just get measured differently — they get *served* differently, because the backend knows their device is under pressure.

## How It Fits Into Our Release Cycle

Armitage isn't just a production tool. It's integrated into how we ship:

**During development**: Any engineer can run Armitage on their feature branch and get a performance report without touching Xcode Instruments.

**Before merge**: The anomaly report is attached to the pull request. Reviewers can see if the feature degrades performance on any tracked page.

**At release gate**: Jenkins runs automated performance tests on Headspin device farm across P0 pages (Home, PLP, PDP). Red/yellow/green reports go to Slack with tagged engineering managers.

**In production**: A controlled cohort of real users provides continuous telemetry, catching issues that lab conditions miss — like a specific OEM's aggressive memory management killing background processes.

## What We Learned

Building Armitage taught us a few things worth sharing:

**Measure the measurement.** Our FPS collection adds ~1-2% CPU overhead. That's acceptable. But we had early prototypes that added 8%. If your performance tool degrades performance, you've created a Heisenberg problem. Benchmark your benchmarks.

**Device diversity is the hard problem.** India's Android ecosystem is wildly fragmented. A technique that works on a Pixel might crash on a Xiaomi. KMP helped enormously here — one codebase for the logic, platform-specific only where the OS forces it.

**Synchronous bridges matter for instrumentation.** The async React Native bridge added enough latency to misattribute 200ms of data to the wrong page. JSI eliminated this entirely.

**Separate your databases.** We initially tried a single database and saw write contention degrade our own measurements. Seven databases sound excessive until you realize they run at seven different frequencies.

**Grade on a curve.** Absolute thresholds are useless across a device spectrum this wide. Tier-aware scoring lets you have a meaningful conversation about performance regardless of hardware.

---

*Armitage is now a core part of Myntra's mobile engineering workflow — quietly running in the background, watching every frame, every byte of memory, every CPU spike. It doesn't slow down the patient. It just listens to the heartbeat and tells us when something needs attention.*

*And the next time you scroll through Myntra and it feels smooth? A little system called Armitage helped make sure of that.*

---

**Authors**: Mobile Performance Team, Myntra

**Stack**: Kotlin Multiplatform · React Native · JSI · SqlDelight · Firebase Performance · Headspin
