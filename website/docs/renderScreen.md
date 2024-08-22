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

#### content &nbsp;•&nbsp; `string` {#content}

Screen content to render

#### options &nbsp;•&nbsp; `Object` {#options}

A config object to specify the configuration options listed below.

> *Required Options:*
[`columns`](options.md#columns),
[`rows`](options.md#rows)

> *Terminal Options:*
[`tabSize`](options.md#tabSize),
[`cursorHidden`](options.md#cursorHidden),
[`windowTitle`](options.md#windowTitle),
[`windowIcon`](options.md#windowIcon)

> *Output Options:*
[`output`](options.md#output),
[`outputPath`](options.md#outputPath),
[`scaleFactor`](options.md#scaleFactor),
[`embedFonts`](options.md#embedFonts),
[`fonts`](options.md#fonts)

> *Rendering Options:*
[`theme`](options.md#theme),
[`fontFamily`](options.md#fontFamily),
[`fontSize`](options.md#fontSize),
[`lineHeight`](options.md#lineHeight),
[`columnWidth`](options.md#columnWidth),
[`iconColumnWidth`](options.md#iconColumnWidth),
[`borderRadius`](options.md#borderRadius),
[`boxShadow`](options.md#boxShadow),
[`offsetX`](options.md#offsetX),
[`offsetY`](options.md#offsetY),
[`paddingX`](options.md#paddingX),
[`paddingY`](options.md#paddingY),
[`decorations`](options.md#decorations),
[`insetMajor`](options.md#insetMajor),
[`insetMinor`](options.md#insetMinor)

> *Debugging Options:*
[`logLevel`](options.md#logLevel)
