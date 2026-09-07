# Accelerating CPA Audits: Building a Visual OCR Verification Engine for Tax Forms

At FlyFin, we were building an AI-driven tax platform designed to make US tax filing effortless for freelancers and self-employed individuals. Think TurboTax, but turbocharged with AI to automatically parse income, classify expenses, and claim hidden deductions, backed by a team of human CPAs who reviewed every return before e-filing.

## The Bottleneck

Our backend pipelines used [AWS Textract](https://aws.amazon.com/textract/) to extract key-value data from uploaded W-2s, 1099s, and Schedule C forms. However, because tax filing errors carry strict legal penalties, our internal CPAs had to audit every extracted digit for 100% accuracy before submission.

The workflow was painfully slow: a CPA would look at an extracted value like "Box 1 Wages: $85,420" on their dashboard sidebar, then spend 15 to 20 seconds manually scanning and squinting through a dense, multi-page PDF on the right side of the screen trying to find where that number actually came from. Multiply that friction by thousands of tax forms, and document review became our single biggest operational bottleneck.

## The Solution

To eliminate this manual search, we built a client-side visual verification tool directly into the internal CPA dashboard. Instead of manually hunting through pages, a CPA could simply click any extracted tax field on their screen. The PDF viewer would instantly auto-scroll to the exact location on the document and highlight the source text with a bounding box.

## Technical Deep-Dive

To render documents with precision inside our CPA dashboard, we built a custom, lightweight React package around `[pdfjs-dist](https://mozilla.github.io/pdf.js/)` to handle component lifecycles, canvas scaling, and drawing bounding boxes.

### Architecture of the Custom React Package

Our component architecture decouples document fetching from page-level canvas painting:

```text
[ CPA Dashboard ]
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ <PdfViewer /> (Document Lifecycle & Scroll Container)  │
│  ├─ Manages Worker Initialization                      │
│  ├─ Fetches Document & Tracks Page Offsets             │
│  └─ Exposes imperative scrollToField() API via Ref     │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│ <PdfPage page={1} />     │   │ <PdfPage page={2} />     │
│  ├─ Base Canvas (PDF.js) │   │  ├─ Base Canvas (PDF.js) │
│  └─ Overlay Canvas (OCR) │   │  └─ Overlay Canvas (OCR) │
└──────────────────────────┘   └──────────────────────────┘
```



### 1. Top-Level Container: `<PdfViewer/>`

The `<PdfViewer/>` component acts as the document host and primary scroll container for the PDF.

- **Worker Management:** Initializes the PDF.js background [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) globally and executes `pdfjsLib.getDocument()`. It manages the asynchronous fetching of binary PDF streams off the main thread.
- **Layout & Offset Tracking:** Renders a scrollable container viewport and maps through the loaded page array to mount individual `<PdfPage/>` components.
- **Imperative Ref API (**`scrollToField`**):** Exposes an imperative handle to the parent CPA Dashboard using `[useImperativeHandle](https://react.dev/reference/react/useImperativeHandle)`. When an operator clicks a tax field in the sidebar it triggers a smooth programmatic scrolling to the page.



### 2. Individual Page Unit: `<PdfPage/>`

Every page in the PDF document is rendered by its own isolated `<PdfPage/>` instance, which employs a Dual-Canvas Stack:

- **Base Canvas (PDF.js):** Dedicated strictly to executing `pdfPage.render()`. It paints vector shapes, images, and font glyphs onto an [HTML5 canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API). Because PDF vector rendering is computationally heavy, this canvas only updates during page load, zoom level adjustments, or viewport resizes.
- **Overlay Canvas (OCR Bounding Boxes):** A transparent HTML5 canvas layered directly on top of the base canvas via absolute positioning. It handles drawing AWS Textract bounding boxes.



## Technical Highlights



### 1. Decoding the AWS Textract Spatial Payload

AWS Textract returns document structure inside a JSON payload containing `Block` objects for every detected key-value pair, table cell, or text string. Rather than physical pixel dimensions, Textract provides spatial geometry as normalized floats bound between `0.0` and `1.0`:

```json
{
  "BlockType": "KEY_VALUE_SET",
  "Page": 2,
  "Geometry": {
    "BoundingBox": {
      "Width": 0.2845,
      "Height": 0.0312,
      "Left": 0.1420,
      "Top": 0.4210
    }
  }
}
```

Because these floats represent percentages of overall page dimensions, they remain resolution-independent—allowing us to scale bounding boxes seamlessly regardless of viewport size or zoom level.

### 2. Snap to Correct Page

When a CPA selects a tax field to audit, we extract the target `Page` number from the Textract payload. To keep document navigation fast and predictable, each page canvas is wrapped in a dedicated DOM container (`<div id={page-${pageNumber}}>`).

Instead of calculating complex inner-viewport pixel offsets, we snap the target page wrapper directly to the top edge of the scroll container:

```javascript
function jumpToTaxField(pageNumber, boundingBox) {
  // 1. Smoothly snap the page container to the top of the viewport
  const pageWrapper = document.getElementById(`page-${pageNumber}`);
  if (pageWrapper) {
    pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 2. Pass target bounding box props to trigger overlay rendering
  setActiveHighlight({ pageNumber, box: boundingBox });
}
```



### 3. Coordinate Mapping & Dual-Canvas Painting

Redrawing the base PDF page canvas via PDF.js is computationally expensive. To maintain 60 FPS performance during field navigation, we paint bounding boxes onto an independent, transparent HTML5 `<canvas>` layered directly over the base PDF page.

To draw the highlight, we map Textract's normalized floats to physical canvas pixels adjusted for `window.devicePixelRatio` (`dpr`):

```text
X_canvas = Left_normalized  × W_canvas
Y_canvas = Top_normalized   × H_canvas
W_box    = Width_normalized × W_canvas
H_box    = Height_normalized × H_canvas
```

The secondary overlay executes a clear-and-draw cycle in under 1ms:

```javascript
function drawFieldHighlight(overlayCtx, box, canvasWidth, canvasHeight, dpr) {
  // Clear previous overlay state
  overlayCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Map normalized coordinates to High-DPI canvas pixels
  const x = box.Left * canvasWidth;
  const y = box.Top * canvasHeight;
  const w = box.Width * canvasWidth;
  const h = box.Height * canvasHeight;

  // Draw semi-transparent highlight with high-contrast border
  overlayCtx.fillStyle = 'rgba(0, 184, 148, 0.35)';
  overlayCtx.strokeStyle = '#00b894';
  overlayCtx.lineWidth = 2 * dpr;
  overlayCtx.fillRect(x, y, w, h);
  overlayCtx.strokeRect(x, y, w, h);
}
```



## Issues

Every mounted HTML5 `<canvas>` allocates raw GPU and RAM texture memory proportional to its physical pixel dimensions (`W × H × dpr² × 4 bytes`). With a dual-canvas architecture, a standard 10-page W-2 return requires 20 active canvas contexts which is lightweight consuming approx ~150 MB memory footprint that modern devices handle effortlessly.

However, scaling this unvirtualized approach to a 100-page corporate tax document forces the browser to retain 200 high-DPI canvas contexts in DOM memory simultaneously. This pushes tab memory consumption beyond 1.5 GB, triggering aggressive browser garbage collection, frame drops during rapid scrolling, or outright tab crashes on memory-constrained devices.

So we had to implement a form of page virtualization to support large and high-resolution PDFs.

## Canvas Viewport Virtualization

```text
[ Unmounted Placeholder ]
        │
        │  (Scroll Near Viewport)
        ▼
[ IntersectionObserver Trigger ]
        │
        ▼
[ Mount Canvas & Execute Render ]
        │
        │  (Scroll Out of View)
        ▼
[ Destroy Canvas Context ]
```



### How It Works

- **Placeholder Layout Shells:** The DOM renders lightweight `<div>` elements for all pages, with proper page aspect ratios. This maintains accurate document dimensions and native scrollbar behavior without rendering actual pixels.
- **[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) Monitoring:** An observer tracks which page slots enter a visibility threshold (e.g., current viewport plus a 5-page prefetch buffer above and below).
- **Dynamic Mount & Unmount Lifecycle:**
  - **Entering View:** The component mounts the `<canvas>` element and triggers `page.render()`.
  - **Exiting View:** The component unmounts the `<canvas>` element, cancels active `RenderTask` executions, and resets canvas contexts (`canvas.width = 0`). The page reverts back to a lightweight placeholder `<div>`.

**Engineering Benefit:** Memory consumption scales `O(1)` based on viewport height rather than `O(N)` based on document page count.

## Measurable Business & Engineering Impact

- **Instant Verification Velocity:** CPAs dropped manual document search times by over 70%, navigating directly to audited tax fields (e.g., W-2 Box 1, 1099-NEC) in a single click.
- **60 FPS UI Responsiveness:** Moving dynamic highlights off the base PDF canvas completely eliminated re-render lag, keeping scrolling and zooming smooth.



## What We Could Improve Next

- **WASM-Powered Engine (PDFium):** Migrating from PDF.js to C++ compiled WebAssembly ([pdfium](https://pdfium.googlesource.com/pdfium/)/WASM) would deliver 3x to 5x faster binary parsing and rasterization, completely bypassing JavaScript garbage collection spikes.
- **Server-Side Tiled Rendering:** For multi-hundred-page corporate returns, shifting from client-side rendering to cloud-based tile generation (serving WebP tiles like Google Maps) would guarantee instant sub-100ms load times on any device.

