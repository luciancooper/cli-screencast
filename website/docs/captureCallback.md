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

Connect capture session to `process.stdin` to read input from the user. Defaults to `false`.

> [!warning]
> This option must be enabled if you want to read keyboard input from the underlying `stdin` tty stream.

## Usage

### Capturing writes to `stdout`

Here is an example of capturing a callback function that writes to `process.stdout`:

```js result='./assets/usage--callback--stdout.svg'
import { captureCallback } from 'cli-screencast';

captureCallback((capture) => {
    console.log('1st write...');
    capture.wait(1500); // capture recording artificially waits 1.5s
    process.stdout.write('2nd write...');
    capture.wait(1500); // wait 1.5s
    console.log('\n3rd write...');
    capture.wait(1500); // wait 1.5s
}, { columns: 50, rows: 10 }).then((svg) => {
    // svg output string...
});
```

### Capturing input from `stdin`

Here is an example of capturing a callback function that gets input from `process.stdin`. Input from `stdin` can be mocked using `capture.emitKeypress` and `capture.emitKeypressSequence` methods, or the [`connectStdin`](#connectStdin) option can be enabled and you can provide the input yourself. If **all** the input required by your callback function is not mocked, then [`connectStdin`](#connectStdin) **must** be enabled, or else you will not be able to interact with `process.stdin` and the capture will hang.

In this example, `capture.emitKeypressSequence` is used to mock typing `Hello World!` and then hitting <kbd>return</kbd>:

```js result='./assets/usage--callback--stdin.svg'
import { captureCallback } from 'cli-screencast';

captureCallback(async (capture) => {
    // create a readline interface
    const rl = capture.createInterface();
    // ask the user a question
    const promise = new Promise((resolve) => {
        rl.question('Write a message: ', resolve);
    });
    // wait 1s
    capture.wait(1000);
    // mock the user typing their response
    capture.emitKeypressSequence([
        'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd', '!', 'return',
    ]);
    // wait for the response to resolve
    const result = await promise;
    // display the user's response
    console.log(`Your Message: ${result}`);
    // close the readline interface
    rl.close();
}, { columns: 50, rows: 10 }).then((svg) => {
    // svg output string...
});
```

### Emulating a command

You can emulate capturing a command by passing a command string to the `capture.start` method. A command prompt with animated keystrokes will be included at the start of the capture. This capture example emulates running the command `echo Hello World!`:

```js result='./assets/usage--callback--command.svg'
import { captureCallback } from 'cli-screencast';

captureCallback(async (capture) => {
    capture.start('echo Hello World!');
    console.log('Hello World!');
}, { columns: 50, rows: 10, cursorHidden: true }).then((svg) => {
    // svg output string...
});
```

The [`keystrokeAnimationInterval`](options.md#keystrokeAnimationInterval) option can be configured to customize the speed of the keystroke animation, and the prompt prefix can be customized via the [`prompt`](options.md#prompt) option. The command prompt can be captured without an animation by disabling the [`keystrokeAnimation`](options.md#keystrokeAnimation) option.
