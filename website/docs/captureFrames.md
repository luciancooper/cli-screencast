---
title: captureFrames
description: Create an animated terminal screen capture from an array of content frames
keywords: [api]
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
  [endTimePadding](options.md#endTimePadding)

Command Related
: [includeCommand](options.md#includeCommand),
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

#### command «`string`» {#command}

Command prompt string to include in the beginning of the capture. It will only be rendered if the [`includeCommand`](options.md#includeCommand) option is enabled.

## Usage

Here is a basic example of how to create a screen capture from an array of content frames:

```js result='./assets/usage--frames.svg'
import { captureFrames } from 'cli-screencast';

const frames = [
    { content: 'Hello World!', duration: 1500 },
    { content: '\n1st Write...', duration: 1500 },
    { content: '\n2nd Write...', duration: 1500 },
    { content: '\n3rd Write...', duration: 1500 },
];

captureFrames(frames, { columns: 50, rows: 10 }).then((svg) => {
    // svg output string...
});
```
