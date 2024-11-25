---
title: Options
toc_min_heading_level: 2
pagination_next: null
pagination_prev: null
---

# Options

The following options are common to all API methods.

## Terminal Options

#### columns «!`number`» {#columns}

The column width of the captured terminal window.

#### rows «!`number`» {#rows}

The row height of the captured terminal window.

#### tabSize «`number`» {#tabSize}

Tab column width. Defaults to `8`.

#### cursorHidden «`boolean`» {#cursorHidden}

Cursor is hidden in the captured terminal recording or frame. Defaults to `false`.

#### windowTitle «`string`» {#windowTitle}

Terminal window title. Default is `undefined`. See the [window title](window#title-and-icon) section for more details.

#### windowIcon «`string | boolean`» {#windowIcon}

Icon to display next to the terminal window title. Can be set to a keyword string to specify a specific icon (see the [window icon keywords](window.md#icon-keywords) section for a list of keywords). If set to `true`, the value of [`windowTitle`](#windowTitle) is used. Default is `undefined`.

## Output Options

#### output «`string`» {#output}

The desired output format. Must be either `'svg'`, `'png'`, `'json'`, or `'yaml'`. The default is `'svg'`.

For more details on controlling the output format, please refer to the [Output](output.md#the-output-option) section of this documentation.

#### outputPath «`string | string[]`» {#outputPath}

File path or array of file paths to write output to. The type of output (**SVG**, **PNG**, **JSON**, or **YAML**) will be inferred by the file extension provided in each path (e.g., `.svg`, `.png`, `.json`, or `.yaml`). Default is `undefined`.

For more details about saving output directly to a file, please refer to the [Output](output.md#the-outputpath-option) section of this documentation.

#### scaleFactor «`number`» {#scaleFactor}

The device scale factor used when rendering to png. Default is `4`.

> [!note]
> This option is only applicable when rendering to png.

#### embedFonts «`boolean`» {#embedFonts}

Embed required fonts when rendering to svg, Defaults to `true`. Read more about embedding fonts on the [fonts page](fonts.md).

> [!note]
> This option is only applicable when rendering to svg.

#### fonts «`string[]`» {#fonts}

Array of font file paths or urls to resolve fonts from. These fonts will supplement any locally installed system fonts. Default is `undefined`. Supported font formats include **TTF**, **OTF**, **TTC**, and **WOFF2**. See the [supplying additional fonts](fonts.md#supplying-additional-fonts) section for more info.

> [!note]
> **WOFF** files and compressed **ZIP** files or directories are not supported.

## Capture Options

#### writeMergeThreshold «`number`» {#writeMergeThreshold}

Consecutive writes will be merged if they occur within this number of milliseconds of each other. Default is `80`.

#### endTimePadding «`number`» {#endTimePadding}

Milliseconds to add to the end of a captured terminal recording. Default is `500`.

#### cropStartDelay «`boolean`» {#cropStartDelay}

Remove the time difference between the start of the capture and the first write when capturing a terminal recording. Defaults to `true`.

#### captureCommand «`boolean`» {#captureCommand}

Include a prompt and command string at the beginning of a captured recording, if the recording was started with a command. Defaults to `true`.

#### prompt «`string`» {#prompt}

The prompt prefix string to use when a command is captured. Default is `'> '`.

> [!note]
> This option is only applicable when [`captureCommand`](#captureCommand) is `true`.

#### keystrokeAnimation «`boolean`» {#keystrokeAnimation}

Include a command input keystroke animation at the start of the recording if command prompt line is captured. Defaults to `true`.

> [!note]
> This option is only applicable when [`captureCommand`](#captureCommand) is `true`.

#### keystrokeAnimationInterval «`number`» {#keystrokeAnimationInterval}

The delay in milliseconds between keystrokes to use when creating a command input animation. Default is `140`.

> [!note]
> This option is only applicable when [`keystrokeAnimation`](#keystrokeAnimation) is `true`.

## Debugging Options

#### logLevel «`string`» {#logLevel}

Controls how much info is logged to the console during the render process. Options are (in order of descending verbosity): `'debug'`, `'info'`, `'warn'`, `'error'`, and `'silent'`. Defaults to `'warn'`.

## Rendering Options

#### theme «`Object`» {#theme}

Terminal theme specification object. See the [themes](theme.md) page for more details.

#### fontFamily «`string`» {#fontFamily}

Font to use for the rendered terminal output, as a CSS style list. Default is `"'Monaco', 'Cascadia Code', 'Courier New'"`.

#### fontSize «`number`» {#fontSize}

The font size of the rendered terminal output. Default is `12`.

#### lineHeight «`number`» {#lineHeight}

The line height of the rendered terminal output. Default is `1.2`.

#### columnWidth «`number`» {#columnWidth}

The aspect ratio used to determine the width of each terminal column, which will be calculated as this value times the [`fontSize`](#fontSize). If unspecified, the renderer will attempt to determine the aspect ratio of the specified [`fontFamily`](#fontFamily), but if that fails will fall back to the standard value `0.6`.

Refer to the [column width and line height](fonts.md#column-width-and-line-height) section for more info about how fonts affect column width.

#### iconColumnWidth «`number`» {#iconColumnWidth}

The column span of title icons in the rendered terminal output. Default is `1.6`.

#### borderRadius «`number`» {#borderRadius}

Border radius of the rendered terminal window frame. Default is <code>0.25 * <a href="#fontSize">fontSize</a></code>.

#### boxShadow «`boolean | Object`» {#boxShadow}

Render a box shadow around the window frame. Default is `false`. If set to `true`, a default shadow effect will be rendered. Otherwise a box shadow options object can be specified to customize the shadow effect; see the [window box shadow](window.md#box-shadow) section for details on the supported customization options.

#### offsetX «`number`» {#offsetX}

Space in pixels between the rendered terminal window frame and the left and right edges of the image. Default is <code>0.75 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

#### offsetY «`number`» {#offsetY}

Space in pixels between the rendered terminal window frame and the top and bottom edges of the image. Default is <code>0.75 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

#### paddingX «`number`» {#paddingX}

Amount of padding in pixels to be added to the left and right of the rendered window content box. Default is <code>0.25 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

#### paddingY «`number`» {#paddingY}

Amount of padding in pixels to be added to the top and bottom of the rendered window content box. Default is <code>0.25 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

#### decorations «`boolean`» {#decorations}

Render the terminal window with stoplight buttons in the top left corner. Defaults to `true`. See the [window configuration](window.md) page for details.

#### insetMajor «`number`» {#insetMajor}

Amount of inset space in pixels added to the top of the window frame when rendering it with decorations. Default is <code>2.5 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

> [!note]
> This option is ignored if [`decorations`](#decorations) is `false`.

#### insetMinor «`number`» {#insetMinor}

Amount of inset space in pixels added to the left, right, and bottom of the window frame when rendering it with decorations. Default is <code>1.25 * <a href="#fontSize">fontSize</a></code>. See the [window configuration](window.md) page for details.

> [!note]
> This option is ignored if [`decorations`](#decorations) is `false`.
