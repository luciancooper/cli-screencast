---
title: captureCallback
description: Capture all writes within a callback function
keywords: [api]
pagination_next: null
pagination_prev: null
---

# captureCallback

## `captureCallback(fn, options)` {#signature}

Asynchronous function that captures all writes to `process.stdout` and `process.stderr` that occur within a callback function, and renders an animated terminal screencast.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### fn «!`(capture) => any`» {#fn}

Callback function within which terminal output is captured. Can be synchronous or asynchronous. The callback function will be passed a [`NodeCapture`](#NodeCapture) instance.

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
  [cropStartDelay](options.md#cropStartDelay)

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

#### silent «`boolean`» {#silent}

Silently capture output to `process.stdout` and `process.stderr`. Defaults to `true`.

#### connectStdin «`boolean`» {#connectStdin}

Connect capture session to `process.stdin` to read input from the user. Defaults to `false`.

> [!warning]
> This option must be enabled if you want to read keyboard input from the underlying `stdin` tty stream.

## NodeCapture API {#NodeCapture}

A `NodeCapture` instance is passed to the captured callback function as its only argument. It allows you to interact with the capture recording.

#### `capture.columns` «`number`» {#capture.columns}

The column width of the capture recording window, set by the [`columns`](options.md#columns) option. Within the scope of the captured callback, you can also get this value from [`process.stdout.columns`](https://nodejs.org/api/tty.html#writestreamcolumns), or the [`process.stdout.getWindowSize()`](https://nodejs.org/api/tty.html#writestreamgetwindowsize) function.

#### `capture.rows` «`number`» {#capture.rows}

The row height of the capture recording window, set by the [`rows`](options.md#rows) option. Within the scope of the captured callback, you can also get this value from [`process.stdout.rows`](https://nodejs.org/api/tty.html#writestreamrows), or the [`process.stdout.getWindowSize()`](https://nodejs.org/api/tty.html#writestreamgetwindowsize) function.

#### `capture.start(command)` «`(command?) => void`» {#capture.start}

Start the capture. You can optionally pass a command prompt string to include in the beginning of the capture - see [emulating a command](#emulating-a-command) below for an example of this.

#### `capture.finish(error)` «`(error?) => void`» {#capture.finish}

Finish the capture, optionally passing in an error to display at the end of the recording.

#### `capture.wait(ms)` «`(ms) => void`»  {#capture.wait}

Adds the specified number of milliseconds to the capture recording.

#### `capture.setTitle(title, icon)` «`(title) => void`»  {#capture.setTitle}

Set the title and icon of the terminal window in the recorded capture. The `title` argument can be a `string` to set the window title, or a `{ title: string, icon: string }` object to set both the title and icon (see available icons [here](window.md#icon-keywords)). Passing empty strings will clear the title / icon.

Under the hood, this is just a convenience function that writes OSC escape sequences to change the window title and icon. See the [window title and icon configuration section](window.md#title-and-icon) for more info, as well as this [usage example](window.md#title-and-icon-examples).

#### `capture.createInterface(options)` «`(options?) => Interface`» {#capture.createInterface}

Create a new [`readline.Interface`](https://nodejs.org/api/readline.html#class-readlineinterface) instance. This is just a wrapper around the built in [`readline.createInterface`](https://nodejs.org/api/readline.html#readlinecreateinterfaceoptions) function, injecting the capture recording's input stream. The same options can be provided as `readline.createInterface`, with the exception of the `input`, `tabSize`, and `terminal` fields.

#### `capture.emitKeypress(key)` «`(key) => Promise`» {#capture.emitKeypress}

Writes a key `string` to the capture's input stream, simulating a single write to `process.stdin` in the terminal environment. Returns a promise that resolves once the write has been made.

The provided key string can be a keyword to specify a particular keypress or sequence of keypresses. Each keyword represents an escape sequence to write to the input stream. See the reference table below for a full list of available keywords.

<details>
<summary>*Keypress Keywords Reference*</summary>

| Keyword* | Keypresses* | Escape Sequence* |
| :-- | :-- | :-- |
| `'space'` | <kbd>Space</kbd> | `' '` |
| `'backspace'` | <kbd>Backspace</kbd> | `'\x7F'` |
| `'tab'` | <kbd>Tab</kbd> | `'\t'` |
| `'escape'` | <kbd>Esc</kbd> | `'\x1b'` |
| `'return'` | <kbd>Return</kbd> | `'\r'` |
| `'enter'` | <kbd>Enter</kbd> | `'\n'` |
| `'up'` | <kbd>Up</kbd> | `'\x1b[A'` |
| `'down'` | <kbd>Down</kbd> | `'\x1b[B'` |
| `'right'` | <kbd>Right</kbd> | `'\x1b[C'` |
| `'left'` | <kbd>Left</kbd> | `'\x1b[D'` |
| `'clear'` | <kbd>Clear</kbd> | `'\x1b[E'` |
| `'insert'` | <kbd>Insert</kbd> | `'\x1b[2~'` |
| `'delete'` | <kbd>Delete</kbd> | `'\x1b[3~'` |
| `'pageup'` | <kbd>PgUp</kbd> | `'\x1b[5~'` |
| `'pagedown'` | <kbd>PgDn</kbd> | `'\x1b[6~'` |
| `'home'` | <kbd>Home</kbd> | `'\x1b[7~'` |
| `'end'` | <kbd>End</kbd> | `'\x1b[8~'` |
| `'f1'` | <kbd>F1</kbd> | `'\x1b[11~'` |
| `'f2'` | <kbd>F2</kbd> | `'\x1b[12~'` |
| `'f3'` | <kbd>F3</kbd> | `'\x1b[13~'` |
| `'f4'` | <kbd>F4</kbd> | `'\x1b[14~'` |
| `'f5'` | <kbd>F5</kbd> | `'\x1b[15~'` |
| `'f6'` | <kbd>F6</kbd> | `'\x1b[17~'` |
| `'f7'` | <kbd>F7</kbd> | `'\x1b[18~'` |
| `'f8'` | <kbd>F8</kbd> | `'\x1b[19~'` |
| `'f9'` | <kbd>F9</kbd> | `'\x1b[20~'` |
| `'f10'` | <kbd>F10</kbd> | `'\x1b[21~'` |
| `'f11'` | <kbd>F11</kbd> | `'\x1b[23~'` |
| `'f12'` | <kbd>F12</kbd> | `'\x1b[24~'` |
| `'ctrl-a'` | <kbd>Ctrl</kbd> + <kbd>A</kbd> | `'\x01'` |
| `'ctrl-b'` | <kbd>Ctrl</kbd> + <kbd>B</kbd> | `'\x02'` |
| `'ctrl-c'` | <kbd>Ctrl</kbd> + <kbd>C</kbd> | `'\x03'` |
| `'ctrl-d'` | <kbd>Ctrl</kbd> + <kbd>D</kbd> | `'\x04'` |
| `'ctrl-e'` | <kbd>Ctrl</kbd> + <kbd>E</kbd> | `'\x05'` |
| `'ctrl-f'` | <kbd>Ctrl</kbd> + <kbd>F</kbd> | `'\x06'` |
| `'ctrl-k'` | <kbd>Ctrl</kbd> + <kbd>K</kbd> | `'\x0b'` |
| `'ctrl-n'` | <kbd>Ctrl</kbd> + <kbd>N</kbd> | `'\x0e'` |
| `'ctrl-p'` | <kbd>Ctrl</kbd> + <kbd>P</kbd> | `'\x10'` |
| `'ctrl-u'` | <kbd>Ctrl</kbd> + <kbd>U</kbd> | `'\x15'` |
| `'ctrl-v'` | <kbd>Ctrl</kbd> + <kbd>V</kbd> | `'\x16'` |
| `'ctrl-w'` | <kbd>Ctrl</kbd> + <kbd>W</kbd> | `'\x17'` |
| `'ctrl-up'` | <kbd>Ctrl</kbd> + <kbd>Up</kbd> | `'\x1bOa'` |
| `'ctrl-down'` | <kbd>Ctrl</kbd> + <kbd>Down</kbd> | `'\x1bOb'` |
| `'ctrl-right'` | <kbd>Ctrl</kbd> + <kbd>Right</kbd> | `'\x1bOc'` |
| `'ctrl-left'` | <kbd>Ctrl</kbd> + <kbd>Left</kbd> | `'\x1bOd'` |
| `'ctrl-clear'` | <kbd>Ctrl</kbd> + <kbd>Clear</kbd> | `'\x1bOe'` |
| `'ctrl-insert'` | <kbd>Ctrl</kbd> + <kbd>Insert</kbd> | `'\x1b[2^'` |
| `'ctrl-delete'` | <kbd>Ctrl</kbd> + <kbd>Delete</kbd> | `'\x1b[3^'` |
| `'ctrl-pageup'` | <kbd>Ctrl</kbd> + <kbd>PgUp</kbd> | `'\x1b[5^'` |
| `'ctrl-pagedown'` | <kbd>Ctrl</kbd> + <kbd>PgDn</kbd> | `'\x1b[6^'` |
| `'ctrl-home'` | <kbd>Ctrl</kbd> + <kbd>Home</kbd> | `'\x1b[7^'` |
| `'ctrl-end'` | <kbd>Ctrl</kbd> + <kbd>End</kbd> | `'\x1b[8^'` |
| `'meta-b'` | <kbd>Option</kbd> + <kbd>B</kbd> | `'\x1bb'` |
| `'meta-f'` | <kbd>Option</kbd> + <kbd>F</kbd> | `'\x1bf'` |
| `'meta-d'` | <kbd>Option</kbd> + <kbd>D</kbd> | `'\x1bd'` |
| `'meta-delete'` | <kbd>Option</kbd> + <kbd>Delete</kbd> | `'\x1b[3;3~'` |
| `'meta-backspace'` | <kbd>Option</kbd> + <kbd>Backspace</kbd> | `'\x1b\x7F'` |
| `'shift-tab'` | <kbd>Shift</kbd> + <kbd>Tab</kbd> | `'\x1b[Z'` |
| `'shift-up'` | <kbd>Shift</kbd> + <kbd>Up</kbd> | `'\x1b[a'` |
| `'shift-down'` | <kbd>Shift</kbd> + <kbd>Down</kbd> | `'\x1b[b'` |
| `'shift-right'` | <kbd>Shift</kbd> + <kbd>Right</kbd> | `'\x1b[c'` |
| `'shift-left'` | <kbd>Shift</kbd> + <kbd>Left</kbd> | `'\x1b[d'` |
| `'shift-clear'` | <kbd>Shift</kbd> + <kbd>Clear</kbd> | `'\x1b[e'` |
| `'shift-insert'` | <kbd>Shift</kbd> + <kbd>Insert</kbd> | `'\x1b[2$'` |
| `'shift-delete'` | <kbd>Shift</kbd> + <kbd>Delete</kbd> | `'\x1b[3$'` |
| `'shift-pageup'` | <kbd>Shift</kbd> + <kbd>PgUp</kbd> | `'\x1b[5$'` |
| `'shift-pagedown'` | <kbd>Shift</kbd> + <kbd>PgDn</kbd> | `'\x1b[6$'` |
| `'shift-home'` | <kbd>Shift</kbd> + <kbd>Home</kbd> | `'\x1b[7$'` |
| `'shift-end'` | <kbd>Shift</kbd> + <kbd>End</kbd> | `'\x1b[8$'` |
| `'ctrl-shift-delete'` | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Delete</kbd> | `'\x1b[3;6~'` |

</details>

#### `capture.emitKeypressSequence(sequence)` «`(sequence) => Promise`»  {#capture.emitKeypressSequence}

Makes a sequence of writes capture's input stream, simulating a user typing a sequence of keys to `process.stdin`. Between each write, a fixed number of milliseconds will be added to the capture recording to animate a user typing. This can be configured with the [`keystrokeAnimationInterval`](options.md#keystrokeAnimationInterval) option.

Accepts either a `string` or a `string[]` array. If a `string` is passed, it will be split into characters. If a `string[]` array is passed, keywords can be used like in [`capture.emitKeypress`](#capture.emitKeypress) above. Returns a promise that resolves after all writes have been made.

## Usage

### Capturing writes to `stdout`

Here is an example of capturing a callback function that writes to `process.stdout`:

```js result='./assets/usage--callback--stdout.svg'
import { captureCallback } from 'cli-screencast';

// Capture terminal output with artificial timing
captureCallback((capture) => {
    console.log('1st write...');
    capture.wait(1500); // Wait 1.5s
    process.stdout.write('2nd write...');
    capture.wait(1500); // Wait another 1.5s
    console.log('\n3rd write...');
    capture.wait(1500); // Final 1.5s pause
}, { columns: 50, rows: 10 }).then((svg) => {
    // Use or save the generated SVG string here
});
```

### Capturing input from `stdin`

Here is an example of capturing a callback function that gets input from `process.stdin`. Input from `stdin` can be mocked using [`capture.emitKeypress`](#capture.emitKeypress) and [`capture.emitKeypressSequence`](#capture.emitKeypressSequence) methods, or the [`connectStdin`](#connectStdin) option can be enabled and you can provide the input yourself. If **all** the input required by your callback function is not mocked, then [`connectStdin`](#connectStdin) **must** be enabled, or else you will not be able to interact with `process.stdin` and the capture will hang.

In this example, [`capture.emitKeypressSequence`](#capture.emitKeypressSequence) is used to mock typing `Hello World!` and then hitting <kbd>Return</kbd>:

```js result='./assets/usage--callback--stdin.svg'
import { captureCallback } from 'cli-screencast';

captureCallback(async (capture) => {
    // Create readline interface
    const rl = capture.createInterface();
    // Ask the user a question
    const promise = new Promise((resolve) => {
        rl.question('Write a message: ', resolve);
    });
    // Wait 1 second before typing response
    capture.wait(1000);
    // Mock user typing "Hello World!" and pressing Enter
    capture.emitKeypressSequence([
        'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd', '!', 'return',
    ]);
    // Await the mocked input result
    const result = await promise;
    // Display the user's response
    console.log(`Your Message: ${result}`);
    // Close the readline interface
    rl.close();
}, { columns: 50, rows: 10 }).then((svg) => {
    // Use or save the generated SVG string here
});
```

### Emulating a command

You can emulate capturing a command by passing a command string to the [`capture.start`](#capture.start) method. A command prompt with animated keystrokes will be included at the start of the capture. This capture example emulates running the command `echo Hello World!`:

```js result='./assets/usage--callback--command.svg'
import { captureCallback } from 'cli-screencast';

captureCallback((capture) => {
    // Emulate running 'echo Hello World!'
    capture.start('echo Hello World!');
    // Command output
    console.log('Hello World!');
}, { columns: 50, rows: 10, cursorHidden: true }).then((svg) => {
    // Use or save the generated SVG string here
});
```

The [`keystrokeAnimationInterval`](options.md#keystrokeAnimationInterval) option can be configured to customize the speed of the keystroke animation, and the prompt prefix can be customized via the [`prompt`](options.md#prompt) option. The command prompt can be captured without an animation by disabling the [`keystrokeAnimation`](options.md#keystrokeAnimation) option.
