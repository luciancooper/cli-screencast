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

### Basic Example

This basic example demonstrates how to create a capture of a spinner animation from an array of content frames.

```js result='./assets/usage--frames.svg'
import { captureFrames } from 'cli-screencast';
import chalk from 'chalk';

// Define spinner frames for loading animation
const spinner = ['⡇', '⠏', '⠋', '⠙', '⠹', '⢸', '⣰', '⣠', '⣄', '⣆'];

// Create array of content frames with colored content and duration
const frames = spinner.map((frame) => ({
    content: `\r${chalk.yellow(frame)} Loading`,
    duration: 90, // milliseconds
}));

// Capture frames into an SVG string
captureFrames(frames, {
    columns: 50,
    rows: 10,
    cursorHidden: true,
    endTimePadding: 0,
}).then((svg) => {
    // Use or save the generated SVG string here
});
```

### Emulating a command

This example demonstrates how to use the [`command`](#command) option to capture a command prompt. It captures several frames that visually mimick the behavior of running a real command, and adds a keystroke animation to the beginning of the capture to emulate a user typing in the command.

```js result='./assets/usage--frames--command.svg'
import { captureFrames } from 'cli-screencast';
import chalk from 'chalk';

// Define frames
const frames = [
    { content: '', duration: 500 }, // Initial empty frame for visual pause
    { content: `${chalk.green('✔')} Task 1 Complete\n`, duration: 1500 },
    { content: `${chalk.green('✔')} Task 2 Complete\n`, duration: 1500 },
    { content: `${chalk.red('✘')} Task 3 Failed\n`, duration: 1500 },
];

// Capture frames into an SVG string
captureFrames(frames, {
    command: 'node tasks.js', // Command line prompt to capture
    columns: 50,
    rows: 10,
    cursorHidden: true,
}).then((svg) => {
    // Use or save the generated SVG string here
});
```

The [`keystrokeAnimationInterval`](options.md#keystrokeAnimationInterval) option can be configured to customize the speed of the keystroke animation, and the prompt prefix can be customized via the [`prompt`](options.md#prompt) option. The command prompt can be captured without an animation by disabling the [`keystrokeAnimation`](options.md#keystrokeAnimation) option.
