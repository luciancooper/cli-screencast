---
title: captureSpawn
description: Capture the terminal output of a spawned subprocess
keywords: [api]
pagination_next: null
pagination_prev: null
---

# captureSpawn

## `captureSpawn(command, args, options)` {#signature}

Asynchronous function that captures the output of a spawned subprocess and renders an animated terminal screencast. Signature mimics that of [`child_process.spawn`](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options).

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### command «!`string`» {#command}

The command to run.

#### args «!`string[]`» {#args}

List of string arguments.

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

#### shell «`boolean | string`» {#shell}

Run the command inside of a shell. Default is `false`. If true, Unix will try to use the current shell (`process.env.SHELL`), falling back to `/bin/sh` if that fails, while Windows will try to use `process.env.ComSpec`, falling back to `cmd.exe` if that fails. Different shells can be specified using a string. The shell should understand the `-c` switch, or if the shell is `cmd.exe`, it should understand the `/d /s /c` switches.

#### cwd «`string`» {#cwd}

Working directory to be set for the child process. Default is `process.cwd()`.

#### env «`Object`» {#env}

Environment key-value pairs to be set for the child process. Automatically extends from `process.env`, which can be changed by setting `extendEnv` to `false`. Default is `undefined`.

#### extendEnv «`boolean`» {#extendEnv}

The child process environment extends from `process.env`. Defaults to `true`.

#### silent «`boolean`» {#silent}

Silently capture the spawned process' stdout and stderr output. If set to `false`, the output of the spawned process will be piped to `process.stdout`. Defaults to `true`.

#### connectStdin «`boolean`» {#connectStdin}

Connect spawn to `process.stdin` to capture any input from the user. If the spawned process requires user input to complete, this option must be enabled, or the process will hang. Defaults to `false`.

> [!warning]
> If `connectStdin` is enabled, the [`silent`](#silent) option must be set to `false`, or omitted.

#### timeout «`number`» {#timeout}

The maximum amount of time the process is allowed to run in milliseconds. If greater than `0`, the spawned process will be killed if it runs longer than the timeout milliseconds. Default is `0`.

#### killSignal «`string`» {#killSignal}

The signal to be used when the spawned process is killed by `timeout`. Default is `'SIGTERM'`.

#### useConpty!windows «`boolean`» {#useConpty}

Option passed to [`node-pty`](https://github.com/microsoft/node-pty) concerning whether to use [ConPTY](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/) over [winpty](https://github.com/rprichard/winpty). If set to `undefined`, ConPTY will be used over winpty when the Windows build number is >= 18309. Defaults to `false`.

## Usage

### Capturing a command

Here is a basic example of capturing the output of the command `echo Hello World!`:

```js result='./assets/usage--spawn.svg'
import { captureSpawn } from 'cli-screencast';

captureSpawn('echo', ['Hello World!'], {
    columns: 50,
    rows: 10,
    shell: process.platform === 'win32', // echo must be executed in a shell on Windows
    cursorHidden: true,
    includeCommand: false, // Don't include the command in output
}).then((svg) => {
    // Use or save the generated SVG string here
});
```

### Capturing a command with a prompt

Here is the same example as above, but with the [`includeCommand`](options.md#includeCommand) option enabled, which causes a command prompt with animated keystrokes to be included in the rendered capture.

```js result='./assets/usage--spawn--prompt.svg'
import { captureSpawn } from 'cli-screencast';

captureSpawn('echo', ['Hello World!'], {
    columns: 50,
    rows: 10,
    shell: process.platform === 'win32', // echo must be executed in a shell on Windows
    cursorHidden: true,
    includeCommand: true, // Include the command in the output
}).then((svg) => {
    // Use or save the generated SVG string here
});
```

The [`keystrokeAnimationInterval`](options.md#keystrokeAnimationInterval) option can be configured to customize the speed of the keystroke animation, or the prompt can be captured without the animation by disabling the [`keystrokeAnimation`](options.md#keystrokeAnimation) option. The prompt prefix can be customized via the [`prompt`](options.md#prompt) option.
