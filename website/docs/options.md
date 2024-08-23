---
title: Options
toc_min_heading_level: 2
pagination_next: null
pagination_prev: null
---

# Options

The following options are common to all API methods.

## Terminal Options

#### columns &nbsp;•&nbsp; `number` &nbsp;•&nbsp; **Required** {#columns}

The column width of the captured terminal window.

#### rows &nbsp;•&nbsp; `number` &nbsp;•&nbsp; **Required** {#rows}

The row height of the captured terminal window.

#### tabSize &nbsp;•&nbsp; `number` {#tabSize}

Tab column width. Defaults to `8`.

#### cursorHidden &nbsp;•&nbsp; `boolean` {#cursorHidden}

Cursor is hidden in the captured terminal recording or frame. Defaults to `false`.

#### windowTitle &nbsp;•&nbsp; `string` {#windowTitle}

Terminal window title. Default is `undefined`.

#### windowIcon &nbsp;•&nbsp; `string | boolean` {#windowIcon}

Terminal window icon. Can be set to a keyword string to specify a specific icon (see the [window icons section](window-icons.md) for a list of keywords). If set to `true`, the value of `windowTitle` is used. Default is `undefined`.

## Output Options

#### output &nbsp;•&nbsp; `string` {#output}

The desired output format. Must be either `'svg'`, `'png'`, `'json'`, or `'yaml'`. The default is `'svg'`.

#### outputPath &nbsp;•&nbsp; `string | string[]` {#outputPath}

File path or array of file paths to write output to. The type of output will be inferred by the file extension (can be svg, png, json, or yaml). Default is `undefined`.

#### scaleFactor &nbsp;•&nbsp; `number` {#scaleFactor}

The device scale factor used when rendering to png. Default is `4`.

:::note
This option is only applicable when rendering to png.
:::

#### embedFonts &nbsp;•&nbsp; `boolean` {#embedFonts}

Embed required fonts when rendering to svg, Defaults to `true`.

:::note
This option is only applicable when rendering to svg.
:::

#### fonts &nbsp;•&nbsp; `string[]` {#fonts}

Array of font file paths or urls to resolve fonts from. These fonts will supplement any locally installed system fonts. Supported font types include ttf, otf, ttc, and woff2 formats. Default is `undefined`.

:::note
woff files and zipped font folders are not supported.
:::

## Capture Options

#### writeMergeThreshold &nbsp;•&nbsp; `number` {#writeMergeThreshold}

Consecutive writes will be merged if they occur within this number of milliseconds of each other. Default is `80`.

#### endTimePadding &nbsp;•&nbsp; `number` {#endTimePadding}

Milliseconds to add to the end of a captured terminal recording. Default is `500`.

#### cropStartDelay &nbsp;•&nbsp; `boolean` {#cropStartDelay}

Remove the time difference between the start of the capture and the first write when capturing a terminal recording. Defaults to `true`.

#### captureCommand &nbsp;•&nbsp; `boolean` {#captureCommand}

Include a prompt and command string at the beginning of a captured recording, if the recording was started with a command. Defaults to `true`.

#### prompt &nbsp;•&nbsp; `string` {#prompt}

The prompt prefix string to use when a command is captured. Default is `'> '`.

:::note
This option is only applicable when [`captureCommand`](#captureCommand) is `true`.
:::

#### keystrokeAnimation &nbsp;•&nbsp; `boolean` {#keystrokeAnimation}

Include a command input keystroke animation at the start of the recording if command prompt line is captured. Defaults to `true`.

:::note
This option is only applicable when [`captureCommand`](#captureCommand) is `true`.
:::

#### keystrokeAnimationInterval &nbsp;•&nbsp; `number` {#keystrokeAnimationInterval}

The delay in milliseconds between keystrokes to use when creating a command input animation. Default is `140`.

:::note
This option is only applicable when [`keystrokeAnimation`](#keystrokeAnimation) is `true`.
:::

## Debugging Options

#### logLevel &nbsp;•&nbsp; `string` {#logLevel}

Controls how much info is logged to the console during the render process. Options are (in order of descending verbosity): `'debug'`, `'info'`, `'warn'`, `'error'`, and `'silent'`. Defaults to `'warn'`.

## Rendering Options

#### theme &nbsp;•&nbsp; `Object` {#theme}

Terminal theme specification object. See the [themes](theme.md) section for more details.

#### fontFamily &nbsp;•&nbsp; `string` {#fontFamily}

Font to use for the rendered terminal output, as a CSS style list. Default is `"'Monaco', 'Cascadia Code', 'Courier New'"`.

#### fontSize &nbsp;•&nbsp; `number` {#fontSize}

The font size of the rendered terminal output. Default is `12`.

#### lineHeight &nbsp;•&nbsp; `number` {#lineHeight}

The line height of the rendered terminal output. Default is `1.2`.

#### columnWidth &nbsp;•&nbsp; `number` {#columnWidth}

The aspect ratio used to determine the width of each terminal column, which will be calculated as this value times the [`fontSize`](#fontSize). If unspecified, the renderer will attempt to determine the aspect ratio of the specified [`fontFamily`](#fontFamily), but if that fails will fall back to the standard value `0.6`.

#### iconColumnWidth &nbsp;•&nbsp; `number` {#iconColumnWidth}

The column span of title icons in the rendered terminal output. Default is `1.6`.

#### borderRadius &nbsp;•&nbsp; `number` {#borderRadius}

Border radius of the rendered terminal window frame. Default is `5`.

#### boxShadow &nbsp;•&nbsp; `boolean | Object` {#boxShadow}

Render a box shadow around the window frame. Default is `false`. If set to `true`, a default shadow effect will be rendered. Otherwise a box shadow options object can be specified to customize the shadow effect; see the [window box shadow](box-shadow.md) section for details on the supported customization options.

#### offsetX &nbsp;•&nbsp; `number` {#offsetX}

Space in pixels between the rendered terminal window frame and the left and right edges of the image. Default is `12`.

#### offsetY &nbsp;•&nbsp; `number` {#offsetY}

Space in pixels between the rendered terminal window frame and the top and bottom edges of the image. Default is `12`.

#### paddingX &nbsp;•&nbsp; `number` {#paddingX}

Amount of padding in pixels to be added to the left and right of the rendered window content box. Default is `5`.

#### paddingY &nbsp;•&nbsp; `number` {#paddingY}

Amount of padding in pixels to be added to the top and bottom of the rendered window content box. Default is `5`.

#### decorations &nbsp;•&nbsp; `boolean` {#decorations}

Render the terminal window with stoplight buttons in the top left corner. Defaults to `true`.

#### insetMajor &nbsp;•&nbsp; `number` {#insetMajor}

Amount of inset space in pixels added to the top of the window frame when rendering it with decorations. Default is `40`.

:::note
This option is ignored if [`decorations`](#decorations) is `false`.
:::

#### insetMinor &nbsp;•&nbsp; `number` {#insetMinor}

Amount of inset space in pixels added to the left, right, and bottom of the window frame when rendering it with decorations. Default is `20`.

:::note
This option is ignored if [`decorations`](#decorations) is `false`.
:::

---

The following diagram shows how various window rendering related options function:

![Window Options](./build/window-options.svg)
