# Shaving Off Milliseconds: How We Optimized Myntra’s Android App Startup Time

> "500 milliseconds doesn't matter, nobody notices half a second."

That is one of the most dangerous myths in mobile engineering. When users open an e-commerce app like Myntra, every millisecond dictates whether they make a purchase or abandon the app entirely. Cold boots sit at the absolute top of the conversion funnel, meaning initial startup latency directly impacts retention rates, Android Vitals search rankings, and company revenue.

When I was assigned the task of optimizing launch times for Myntra’s Android app as part of our company-wide performance goals, I knew it would be an intense deep dive into Android OS internals, app lifecycles, and main-thread execution limits.

## The Business & System Case for Speed

Before diving into code, it is critical to understand why app startup optimization isn't just an exercise in engineering pedantry:

- **Conversion & Retention:** A delay of just 100 to 300ms during launch inflates bounce rates, particularly during high-intent flash sales. Modern users expect apps to load in under 2 seconds; long launch times create visual friction that drives churn within the first week.
- **Android Vitals & Play Store Ranking:** Google Play actively tracks [cold-start benchmarks](https://developer.android.com/topic/performance/vitals/launch-time) and penalizes apps exceeding a 5-second threshold. Poor startup numbers hurt organic app store discoverability.
- **System Stability (ANRs):** Heavy main-thread initialization starves the UI thread, causing Application Not Responding (ANR) crashes or OS process terminations.

## Phase 1: Instrumenting the Black Box

The journey began with profiling. Optimization without precise measurement is just guesswork.

To identify bottlenecks, I instrumented the codebase with custom logging markers and leveraged system profiling tools like [Android Studio Profiler](https://developer.android.com/studio/profile). The goal was to map out every millisecond spent between the OS process fork and the first rendered frame ([Time to Initial Display / TTID](https://developer.android.com/topic/performance/vitals/launch-time#time-to-initial-display)).

```text
System Fork (Zygote)
  → Application.attachBaseContext()
  → ContentProviders
  → Application.onCreate()
  → Activity.onCreate()
  → First Frame Draw (TTID)
```

We carefully analyzed library initialization calls, tracking execution duration, thread usage, and dependency constraints. Through this tracing effort, we identified two primary structural bottlenecks in our boot architecture.

The first was how we used Jetpack’s [`androidx.startup`](https://developer.android.com/topic/libraries/app-startup) library.

## The androidx.startup Paradox

To understand the problem, you first have to understand why `androidx.startup` exists in the Android ecosystem.

### The Problem androidx.startup Was Built to Solve

Historically, third-party Android SDKs (Firebase, WorkManager, analytics platforms) initialized themselves automatically using individual `<provider>` ([ContentProvider](https://developer.android.com/guide/topics/providers/content-providers)) tags declared in their `AndroidManifest.xml`.

Because the OS instantiates all `ContentProvider` components on the main UI thread **before** `Application.onCreate()` runs, having 10+ third-party SDKs each running their own `ContentProvider` creates massive startup overhead, inflating TTID before developer code is even executed.

Jetpack's `androidx.startup` library solved this by consolidating initialization into a single `InitializationProvider`, using a Directed Acyclic Graph (DAG) to organize dependencies.

```xml
<!-- Before: Multiple ContentProviders cluttering launch -->
<provider android:name="com.sdk.AProvider" ... />
<provider android:name="com.sdk.BProvider" ... />
<provider android:name="com.sdk.CProvider" ... />

<!-- After: Single InitializationProvider -->
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data
        android:name="com.myntra.SdkAInitializer"
        android:value="androidx.startup" />
</provider>
```

### The Hidden Trap: Sequential Main-Thread Execution

While `androidx.startup` eliminates the overhead of instantiating multiple `ContentProvider` objects, its out-of-the-box execution has a major drawback: it runs every registered `Initializer.create()` **synchronously on the Main (UI) Thread in sequential order**.

```text
[ Default androidx.startup Execution ]

MAIN THREAD: |--- SDK A Init ---|--- SDK B Init ---|--- SDK C Init ---|--> Application.onCreate()
             0ms               120ms             280ms             450ms
```

While App Startup constructs a DAG to handle dependency ordering, it does **not** automatically handle multithreading or concurrency.

At Myntra’s scale, running heavy SDK initializations sequentially on the main thread meant the UI thread was blocked back-to-back, adding hundreds of unnecessary milliseconds to our cold boot time.

## The Solution: Parallel Async Initialization Architecture

By decoupling independent third-party SDKs from the sequential main-thread execution of `androidx.startup`, we converted linear initialization latency into a parallelized background task.

Instead of initializing each library sequentially on the main thread, the custom `AsyncInitializer` triggers four independent background coroutines simultaneously. A thread synchronization barrier (Latch) halts main-thread progression until all four background initializations finish—or until a strict 2-second timeout occurs.

```text
[ androidx.startup Execution Window ]
                              │
                              ▼
                  AsyncInitializer.create()
                              │
                ┌─────────────┴─────────────┐
                │  Main Thread: Latch Await │
                │   (Timeout: 2000ms max)   │
                └─────────────┬─────────────┘
                              │
        ┌─────────────┬───────┴───────┬─────────────┐
        │             │               │             │
        ▼             ▼               ▼             ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ Coroutine 1  │ │ Coroutine 2  │ │ Coroutine 3  │ │ Coroutine 4  │
 │Dispatchers.IO│ │Dispatchers.IO│ │Dispatchers.IO│ │Dispatchers.IO│
 │ SDK A 180ms  │ │ SDK B 250ms  │ │ SDK C  90ms  │ │ SDK D 140ms  │
 │ countDown()  │ │ countDown()  │ │ countDown()  │ │ countDown()  │
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                │                │                │
        └────────────────┴───────┬────────┴────────────────┘
                                 │
                 [ Latch Reaches 0 OR Timeout ]
                                 │
                                 ▼
       Main Thread Unblocks & Continues Application.onCreate()
```

### Execution Timeline Comparison

**Sequential startup latency:**

```text
T_SDK_A + T_SDK_B + T_SDK_C + T_SDK_D
= 180ms + 250ms + 90ms + 140ms
= 660ms
```

**Parallel startup latency:**

```text
max(T_SDK_A, T_SDK_B, T_SDK_C, T_SDK_D)
= max(180, 250, 90, 140)
= 250ms
```

## Optimization #2: Eliminating Heavy JSON Deserialization on the Critical Startup Path

Our second major startup bottleneck was hidden inside our remote configuration pipeline.

At Myntra, we rely on a core service called **Switch** (key-value remote configuration engine). On app launch, the app fires an expedited API call to Switch to retrieve a configuration JSON payload, which is then cached locally in Android's [`SharedPreferences`](https://developer.android.com/reference/android/content/SharedPreferences).

Switch serves as the central control plane for the entire app. It holds:

- **Feature Gates:** Boolean toggles to enable or disable specific features or third-party SDKs on the fly.
- **Dynamic UI Assets:** Image URLs, Lottie animation paths, promotional text, and background hex colors managed by product teams.

### The Bottleneck: The "Parse Everything Upfront" Penalty

During our initial performance profiling, we discovered a massive mismatch between when configuration data was read and when it was actually needed.

```text
[ Legacy Switch Configuration Flow ]

Main Thread:
|-- Read SharedPreferences --|-- Parse Massive JSON Payload --|--> Read 4 Native Keys --> Boot React Native
   (Disk I/O Blocking)          (High CPU Deserialization)
```

To parse and evaluate configuration data during cold start, the app was reading the entire raw Switch JSON string from `SharedPreferences` and deserializing it into memory on the main thread.

This created a severe performance penalty for two reasons:

1. **SharedPreferences Disk I/O Overhead:** When `SharedPreferences` is initialized, Android reads the underlying XML file from storage and loads it into memory. As the Switch payload grew over years of feature additions, this disk read operation became increasingly heavy.
2. **Unnecessary Deserialization:** Deserializing a massive JSON string into Java/Kotlin objects requires heavy CPU cycles, memory allocations, and reflection overhead.

### The Crucial Insight: The React Native Boundary

Through deep dependency tracing, we realized that over **95%** of the Switch configuration payload was only consumed after the React Native framework initialized.

Native Android required only **4 primitive values** during early boot (e.g., dark mode overrides, dynamic splash animation keys, and critical SDK kill-switches). Yet, we were paying the CPU and I/O cost of parsing the entire 95% React-side payload upfront just to read those 4 native values.

## The Solution: A Dual-Cache Architecture with Targeted Prefs

To eliminate main-thread parsing overhead during cold boot, we implemented a **Targeted Minimal Cache** pattern by decoupling startup-critical keys from the main configuration payload.

```text
[ Switch API Response ]
            │
            ▼
┌───────────────────────────────┐
│   Switch Repository Manager   │
└───────────────┬───────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
[ Main Switch Prefs ]   [ Startup Switch Prefs ]
• Holds complete JSON   • Sub-1KB isolated file
• Read lazily when RN   • Stores ONLY the 4 required
  framework boots         startup primitives
• Zero impact on cold   • Read instantly during cold start
  start
```

### Implementation Details

#### 1. Isolated Startup Cache Creation

We created a dedicated `SharedPreferences` file (`startup_switch_config`) strictly reserved for early native boot values. Instead of storing a complex JSON string, it stores primitive key-value pairs directly (Booleans, Strings, Integers), eliminating JSON parsing entirely on cold launch.

#### 2. Background Synchronization & Dual-Write Cache Strategy

To guarantee data consistency, whenever the main Switch API payload updates (either via background fetch or cold-start response), the repository parses the payload off the main thread, extracts the 4 startup-critical keys, and writes them to the lightweight `startup_switch_config` cache in a single atomic transaction.
