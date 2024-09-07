---
title: captureFrames
description: Create an animated terminal screen capture from an array of content frames
pagination_next: null
pagination_prev: null
---

# captureFrames

## `captureFrames(frames, options)` {#signature}

Asynchronous function that creates an animated terminal screen capture from an array of content frames.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### frames «!`Object[]`» {#frames}

Array of content frames in the form of `{ content: string, duration: number }`.

#### options «!`Object`» {#options}

A config object to specify the configuration options listed below.

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
  [endTimePadding](options.md#endTimePadding)

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
