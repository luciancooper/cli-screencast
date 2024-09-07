---
title: renderData
description: Render a screencast or screenshot from a json or yaml data file
pagination_next: null
pagination_prev: null
---

# renderData

## `renderData(path, options)` {#signature}

Asynchronous function that renders a screencast or screenshot from a json or yaml data file. If any of the other api methods were used to write screencast data to json or yaml, this method can be used to render that data to svg or png.

Returns a promise that resolves either a `string` if the [`output`](options.md#output) format option is `'svg'`, or a `Buffer` if the output format is `'png'`.

### Arguments

#### path «!`string`» {#path}

JSON or YAML data file path containing the screencast data to render.

#### options «`Object`» {#options}

A config object to specify the configuration options listed below.

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
