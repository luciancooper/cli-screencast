---
title: renderScreen
description: Render a screenshot
pagination_next: null
pagination_prev: null
---

# renderScreen

## `renderScreen(content, options)` {#signature}

Asynchronous function that renders a terminal screenshot to svg or png, or to a data storage format (json or yaml), depending on the output format specified by the [`output`](options.md#output) option.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, `'json'`, or `'yaml'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### content «!`string`» {#content}

Screen content to render

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

## Usage

Here is an example of rendering a simple screenshot to svg:

```js result='./assets/usage--screen.svg'
import { renderScreen } from 'cli-screencast';
import chalk from 'chalk';

renderScreen(
    `Hello ${chalk.yellow('World!')}`,
    { columns: 50, rows: 20 },
).then((svg) => {
    // svg output string...
});
```
