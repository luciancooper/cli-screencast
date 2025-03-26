---
title: captureShell
description: Capture a shell session
keywords: [api]
pagination_next: null
pagination_prev: null
---

# captureShell

## `captureShell(options)` {#signature}

Asynchronous function that captures a shell session and then renders it as an animated terminal screencast. A new shell session will be spawned and piped to `process.stdout` and `process.stdin`, then you interact with the shell until it is exited or you press `Ctrl+D`.

> [!tip]
> The shell session recording can be stopped with `Ctrl+D`.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments:

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

#### shell «`string`» {#shell}

The shell to run. If unspecified, Unix will try to use the current shell (`process.env.SHELL`), falling back to `/bin/sh` if that fails. Windows will try to use `process.env.ComSpec`, falling back to `cmd.exe` if that fails.

#### cwd «`string`» {#cwd}

Working directory to be set for the shell process. Default is `process.cwd()`.

#### env «`Object`» {#env}

Environment key-value pairs to be set for the shell process. Automatically extends from `process.env`, which can be changed by setting `extendEnv` to `false`. Default is `undefined`.

#### extendEnv «`boolean`» {#extendEnv}

The shell process environment extends from `process.env`. Defaults to `true`.

## Usage

Here is a basic example of a script that spawns and captures a new shell process. It will run powershell on windows or zsh in unix like environments, and the shell will start from the user's home directory. The rendered screencast svg is written to a file called `capture.svg` in the current working directory using the [`outputPath`](options.md#outputPath) option.

Below is an example execution that captures a zsh shell process where the user runs the command `echo Hello World!` and then exits the shell.

```js title='capture.js' demo='./assets/usage--shell--demo.svg' demoTitle='*Example script execution:*' result='./assets/usage--shell--capture.svg' resultTitle='capture.svg'
#!/usr/bin/env node
import { homedir } from 'os';
import { captureShell } from 'cli-screencast';

captureShell({
    // Use PowerShell on Windows, Zsh on Unix-based OS
    shell: process.platform === 'win32' ? 'pwsh.exe' : 'zsh',
    // Start shell session from the user's home directory
    cwd: homedir(),
    columns: 50,
    rows: 10,
    // Customize cursor appearance
    theme: { cursorStyle: 'underline', cursorBlink: true },
    // Save output SVG to a file in the directory this script is run in
    outputPath: './capture.svg',
});
```
