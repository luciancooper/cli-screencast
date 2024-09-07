---
title: captureCallback
description: Capture all writes within a callback function
pagination_next: null
pagination_prev: null
---

# captureCallback

## `captureCallback(fn, options)` {#signature}

Asynchronous function that captures all writes to `process.stdout` and `process.stderr` that occur within a callback function, and renders an animated terminal screencast.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### fn «!`(capture) => any`» {#fn}

Callback function within which terminal output is captured. Can be synchronous or asynchronous. The callback function will be passed a `NodeCapture` instance.

> [!note]
> Within the scope of this function, all writes to `process.stdout` and `process.stderr`, (and by extension calls to `console.log` and `console.error`) will be captured.

#### options «!`Object`» {#options}

A config object to specify the following common options, as well as the additional options listed in the next section.

Required
: [columns](options.md#columns),
  [rows](options.md#rows)

Terminal Related
: [tabSize](options.md#tabSize),
  [cursorHidden](options.md#cursorHidden),
  [windowTitle](options.md#windowTitle),
  [windowIcon](options.md#windowIcon)

Output Related
: [output](options.md#output),
  [outputPath](options.md#outputPath),
  [scaleFactor](options.md#scaleFactor),
  [embedFonts](options.md#embedFonts),
  [fonts](options.md#fonts)

Capture Related
: [writeMergeThreshold](options.md#writeMergeThreshold),
  [endTimePadding](options.md#endTimePadding),
  [cropStartDelay](options.md#cropStartDelay),
  [captureCommand](options.md#captureCommand),
  [prompt](options.md#prompt),
  [keystrokeAnimation](options.md#keystrokeAnimation),
  [keystrokeAnimationInterval](options.md#keystrokeAnimationInterval)

Rendering Related
: [theme](options.md#theme),
  [fontFamily](options.md#fontFamily),
  [fontSize](options.md#fontSize),
  [lineHeight](options.md#lineHeight),
  [columnWidth](options.md#columnWidth),
  [iconColumnWidth](options.md#iconColumnWidth),
  [borderRadius](options.md#borderRadius),
  [boxShadow](options.md#boxShadow),
  [offsetX](options.md#offsetX),
  [offsetY](options.md#offsetY),
  [paddingX](options.md#paddingX),
  [paddingY](options.md#paddingY),
  [decorations](options.md#decorations),
  [insetMajor](options.md#insetMajor),
  [insetMinor](options.md#insetMinor)

Debugging
: [logLevel](options.md#logLevel)

### Additional Options

#### silent «`boolean`» {#silent}

Silently capture output to `process.stdout` and `process.stderr`. Defaults to `true`.

#### connectStdin «`boolean`» {#connectStdin}

Connect capture session to `process.stdin` to capture any input from the user. Defaults to `false`.
