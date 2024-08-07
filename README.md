# cli-screencast

[![ci](https://img.shields.io/github/actions/workflow/status/luciancooper/cli-screencast/ci.yml?logo=github&style=for-the-badge)](https://github.com/luciancooper/cli-screencast/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/gh/luciancooper/cli-screencast?logo=codecov&style=for-the-badge)](https://codecov.io/gh/luciancooper/cli-screencast)
[![license](https://img.shields.io/github/license/luciancooper/cli-screencast?color=yellow&style=for-the-badge)](#license)

## About

An easy to use Node.js API for rendering terminal screenshots and recordings to animated svg or png.

## Installation

Install with `npm`:

```bash
npm install cli-screencast
```

Or with `yarn`:

```bash
yarn add cli-screencast
```

## API

All methods accept an `options` object as the last argument. Options common to all methods are listed in the [options](#options) section below.

All methods are asynchronous and return a `string` or `Buffer` depending on the output format specified by the [`output`](#options.output) option. If `output` is `'svg'`, `'json'`, or `'yaml'`, the method will return a svg, json, or yaml data `string`. If `output` is `'png'`, the method will return a png image `Buffer`.

### `renderScreen(content, options)`

Render a single terminal frame (screenshot) to svg or png, or to a data storage format (json or yaml).

> #### *Arguments:*

› &nbsp; **content** &nbsp;•&nbsp; `string`

Screen content to render

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options).

### `captureFrames(frames, options)`

Create an animated terminal screen capture from an array of content frames.

> #### *Arguments:*

› &nbsp; **frames** &nbsp;•&nbsp; `Object[]`

Array of content frames in the form of `{ content: string, duration: number }`.

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options).

### `captureSpawn(command, args, options)`

Capture the terminal output of a spawned subprocess. Signature mimics that of [`child_process.spawn`](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options).

> #### *Arguments:*

› &nbsp; **command** &nbsp;•&nbsp; `string`

The command to run.

› &nbsp; **args** &nbsp;•&nbsp; `string[]`

List of string arguments.

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options) as well as the additional options listed below.

> #### *Additional Options:*

<a name='options.spawn.shell'></a>
› &nbsp; **shell** &nbsp;•&nbsp; `boolean | string`

Run the command inside of a shell. Default is `false`. If true, Unix will try to use the current shell (`process.env.SHELL`), falling back to `/bin/sh` if that fails, while Windows will try to use `process.env.ComSpec`, falling back to `cmd.exe` if that fails. Different shells can be specified using a string. The shell should understand the `-c` switch, or if the shell is `cmd.exe`, it should understand the `/d /s /c` switches.

<a name='options.spawn.cwd'></a>
› &nbsp; **cwd** &nbsp;•&nbsp; `string`

Working directory to be set for the child process. Default is `process.cwd()`.

<a name='options.spawn.env'></a>
› &nbsp; **env** &nbsp;•&nbsp; `Object`

Environment key-value pairs to be set for the child process. Automatically extends from `process.env`, which can be changed by setting `extendEnv` to `false`. Default is `undefined`.

<a name='options.spawn.extendEnv'></a>
› &nbsp; **extendEnv** &nbsp;•&nbsp; `boolean`

The child process environment extends from `process.env`. Defaults to `true`.

<a name='options.spawn.silent'></a>
› &nbsp; **silent** &nbsp;•&nbsp; `boolean`

Silently capture the spawned process' stdout and stderr output. If set to `false`, the output of the spawned process will be piped to `process.stdout`. Defaults to `true`.

<a name='options.spawn.connectStdin'></a>
› &nbsp; **connectStdin** &nbsp;•&nbsp; `boolean`

Connect spawn to `process.stdin` to capture any input from the user. If the spawned process requires user input to complete, this option must be enabled, or the process will hang. Defaults to `false`. If enabled, the [`silent`](#options.spawn.silent) option must be set to `false`, or omitted.

<a name='options.spawn.timeout'></a>
› &nbsp; **timeout** &nbsp;•&nbsp; `number`

The maximum amount of time the process is allowed to run in milliseconds. If greater than `0`, the spawned process will be killed if it runs longer than the timeout milliseconds. Default is `0`.

<a name='options.spawn.killSignal'></a>
› &nbsp; **killSignal** &nbsp;•&nbsp; `string`

The signal to be used when the spawned process is killed by `timeout`. Default is `'SIGTERM'`.

### `captureShell(options)`

Capture a shell session. A new shell session will be spawned and piped to `process.stdout` and `process.stdin`. The shell session recording can be stopped with `Ctrl+D`.

> #### *Arguments:*

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options) as well as the additional options listed below.

> #### *Additional Options:*

<a name='options.shell.shell'></a>
› &nbsp; **shell** &nbsp;•&nbsp; `string`

The shell to run. If unspecified, Unix will try to use the current shell (`process.env.SHELL`), falling back to `/bin/sh` if that fails. Windows will try to use `process.env.ComSpec`, falling back to `cmd.exe` if that fails.

<a name='options.shell.cwd'></a>
› &nbsp; **cwd** &nbsp;•&nbsp; `string`

Working directory to be set for the shell process. Default is `process.cwd()`.

<a name='options.shell.env'></a>
› &nbsp; **env** &nbsp;•&nbsp; `Object`

Environment key-value pairs to be set for the shell process. Automatically extends from `process.env`, which can be changed by setting `extendEnv` to `false`. Default is `undefined`.

<a name='options.shell.extendEnv'></a>
› &nbsp; **extendEnv** &nbsp;•&nbsp; `boolean`

The shell process environment extends from `process.env`. Defaults to `true`.

### `captureCallback(fn, options)`

Captures all writes to stdout that occur within a callback function.

> #### *Arguments:*

› &nbsp; **fn** &nbsp;•&nbsp; `(source) => void`

Callback function within which terminal output is captured. Can be synchronous or asynchronous. The callback function will be passed a `NodeRecordingStream` instance.

**Note:** Within the scope of this function, all writes to `process.stdout` and `process.stderr`, (and by extension calls to `console.log` and `console.error`) will be captured.

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options) as well as the additional options listed below.

> #### *Additional Options:*

<a name='options.capture.connectStdin'></a>
› &nbsp; **connectStdin** &nbsp;•&nbsp; `boolean`

Connect capture session to `process.stdin` to capture any input from the user. Defaults to `false`.

<a name='options.capture.silent'></a>
› &nbsp; **silent** &nbsp;•&nbsp; `boolean`

Silently capture output to `process.stdout` and `process.stderr`. Defaults to `true`.

### `renderData(path, options)`

Render a screencast or screenshot from a json or yaml data file. If any of the other api methods were used to write screencast data to json or yaml, this method can be used to render that data to svg or png.

> #### *Arguments:*

› &nbsp; **path** &nbsp;•&nbsp; `string`

Json or yaml data file containing the screencast data to render.

› &nbsp; **options** &nbsp;•&nbsp; `Object`

Options config object to specify [configuration options](#options).

## Options

<a name='options.logLevel'></a>
› &nbsp; **logLevel** &nbsp;•&nbsp; `string`

Controls how much info is logged to the console during the render process. Options are (in order of descending verbosity): `'debug'`, `'info'`, `'warn'`, `'error'`, and `'silent'`. Defaults to `'warn'`.

> ### *Output Related Options*

<a name='options.output'></a>
› &nbsp; **output** &nbsp;•&nbsp; `string`

The desired output format. Must be either `'svg'`, `'png'`, `'json'`, or `'yaml'`. The default is `'svg'`.

<a name='options.outputPath'></a>
› &nbsp; **outputPath** &nbsp;•&nbsp; `string | string[]`

File path or array of file paths to write output to. The type of output will be inferred by the file extension (can be svg, png, json, or yaml). Default is `undefined`.

<a name='options.scaleFactor'></a>
› &nbsp; **scaleFactor** &nbsp;•&nbsp; `number`

The device scale factor used when rendering to png. Default is `4`.

**Note:** This option is only applicable when rendering to png.

<a name='options.embedFonts'></a>
› &nbsp; **embedFonts** &nbsp;•&nbsp; `boolean`

Embed required fonts when rendering to svg, Defaults to `true`.

**Note:** This option is only applicable when rendering to svg.

> ### *Capture Related Options*

<a name='options.writeMergeThreshold'></a>
› &nbsp; **writeMergeThreshold** &nbsp;•&nbsp; `number`

Consecutive writes will be merged if they occur within this number of milliseconds of each other. Default is `80`.

<a name='options.endTimePadding'></a>
› &nbsp; **endTimePadding** &nbsp;•&nbsp; `number`

Milliseconds to add to the end of a captured terminal recording. Default is `500`.

<a name='options.cropStartDelay'></a>
› &nbsp; **cropStartDelay** &nbsp;•&nbsp; `boolean`

Remove the time difference between the start of the capture and the first write when capturing a terminal recording. Defaults to `true`.

<a name='options.captureCommand'></a>
› &nbsp; **captureCommand** &nbsp;•&nbsp; `boolean`

Include a prompt and command string at the beginning of a captured recording, if the recording was started with a command. Defaults to `true`.

<a name='options.prompt'></a>
› &nbsp; **prompt** &nbsp;•&nbsp; `string`

The prompt prefix string to use when a command is captured. Default is `'> '`.

**Note:** This option is only applicable when `captureCommand` is `true`.

<a name='options.keystrokeAnimation'></a>
› &nbsp; **keystrokeAnimation** &nbsp;•&nbsp; `boolean`

Include a command input keystroke animation at the start of the recording if command prompt line is captured. Defaults to `true`.

**Note:** This option is only applicable when `captureCommand` is `true`.

<a name='options.keystrokeAnimationInterval'></a>
› &nbsp; **keystrokeAnimationInterval** &nbsp;•&nbsp; `number`

The delay in milliseconds between keystrokes to use when creating a command input animation. Default is `140`.

**Note:** This option is only applicable when `keystrokeAnimation` is `true`.

> ### *Rendering Related Options*

<a name='options.columns'></a>
› &nbsp; **columns** &nbsp;•&nbsp; `number` &nbsp;•&nbsp; **Required**

The column width of the captured terminal window.

<a name='options.rows'></a>
› &nbsp; **rows** &nbsp;•&nbsp; `number` &nbsp;•&nbsp; **Required**

The row height of the captured terminal window.

<a name='options.tabSize'></a>
› &nbsp; **tabSize** &nbsp;•&nbsp; `number`

Tab column width. Defaults to `8`.

<a name='options.cursorHidden'></a>
› &nbsp; **cursorHidden** &nbsp;•&nbsp; `boolean`

Cursor is hidden in the captured terminal recording or frame. Defaults to `false`.

<a name='options.fontSize'></a>
› &nbsp; **fontSize** &nbsp;•&nbsp; `number`

The font size of the rendered terminal output. Default is `16`.

<a name='options.lineHeight'></a>
› &nbsp; **lineHeight** &nbsp;•&nbsp; `number`

The line height of the rendered terminal output. Default is `1.25`.

<a name='options.columnWidth'></a>
› &nbsp; **columnWidth** &nbsp;•&nbsp; `number`

The aspect ratio used to determine the width of each terminal column, which will be calculated as this value times the `fontSize`. If unspecified, the renderer will attempt to determine the aspect ratio of the embedded font family, but if that fails will fall back to the standard value `0.6`.

<a name='options.theme'></a>
› &nbsp; **theme** &nbsp;•&nbsp; `Object`

Terminal theme specification object. See the [themes](#theme) section below.

<a name='options.windowTitle'></a>
› &nbsp; **windowTitle** &nbsp;•&nbsp; `string`

Terminal window title. Default is `undefined`.

<a name='options.windowIcon'></a>
› &nbsp; **windowIcon** &nbsp;•&nbsp; `string | boolean`

Terminal window icon. Can be set to a keyword string to specify a specific icon (see the [window icons section](#window-icons) below for a list of keywords). If set to `true`, the value of `windowTitle` is used. Default is `undefined`.

<a name='options.iconColumnWidth'></a>
› &nbsp; **iconColumnWidth** &nbsp;•&nbsp; `number`

The column span of title icons in the rendered terminal output. Default is `1.6`.

<a name='options.borderRadius'></a>
› &nbsp; **borderRadius** &nbsp;•&nbsp; `number`

Border radius of the rendered terminal window frame. Default is `5`.

<a name='options.boxShadow'></a>
› &nbsp; **boxShadow** &nbsp;•&nbsp; `boolean | Object`

Render a box shadow around the window frame. Default is `false`. If set to `true`, a default shadow effect will be rendered. Otherwise a box shadow options object can be specified to customize the shadow effect; see the [window box shadow](#window-box-shadow) section below for details on the supported customization options.

<a name='options.offsetX'></a>
› &nbsp; **offsetX** &nbsp;•&nbsp; `number`

Space in pixels between the rendered terminal window frame and the left and right edges of the image. Default is `12`.

<a name='options.offsetY'></a>
› &nbsp; **offsetY** &nbsp;•&nbsp; `number`

Space in pixels between the rendered terminal window frame and the top and bottom edges of the image. Default is `12`.

<a name='options.paddingX'></a>
› &nbsp; **paddingX** &nbsp;•&nbsp; `number`

Amount of padding in pixels to be added to the left and right of the rendered window content box. Default is `5`.

<a name='options.paddingY'></a>
› &nbsp; **paddingY** &nbsp;•&nbsp; `number`

Amount of padding in pixels to be added to the top and bottom of the rendered window content box. Default is `5`.

<a name='options.decorations'></a>
› &nbsp; **decorations** &nbsp;•&nbsp; `boolean`

Render the terminal window with stoplight buttons in the top left corner. Defaults to `true`.

<a name='options.insetMajor'></a>
› &nbsp; **insetMajor** &nbsp;•&nbsp; `number`

Amount of inset space in pixels added to the top of the window frame when rendering it with decorations. Default is `40`.

**Note:** This option is ignored if `decorations` is `false`.

<a name='options.insetMinor'></a>
› &nbsp; **insetMinor** &nbsp;•&nbsp; `number`

Amount of inset space in pixels added to the left, right, and bottom of the window frame when rendering it with decorations. Default is `20`.

**Note:** This option is ignored if `decorations` is `false`.

---

<a name='diagram.windowOptions'></a>
The following diagram shows how various window rendering related options function:

<p align="left">
  <a name="window-options-diagram" href="#diagram.windowOptions">
    <img src="media/window-options.svg" alt="window-options"/>
  </a>
</p>

## Theme

The terminal theme can be specified by passing a theme configuration object to the [`theme`](#options.theme) option. One or more of the properties in the table below can be specified, and any unspecified properties will be inherited from the default theme.

> Color values can be configured with any color `string` or a `[number, number, number, number?]` rgba color tuple.

|Property|Description|Default|
|:-------|:----------|:------|
| **black** | SGR foreground code `30` and background code `40` | `#000000`&nbsp;<a href='#'><img valign='middle' alt='#000000' src='https://readme-swatches.vercel.app/000000?style=circle'/></a> |
| **red** | SGR foreground code `31` and background code `41` | `#ff5c57`&nbsp;<a href='#'><img valign='middle' alt='#ff5c57' src='https://readme-swatches.vercel.app/ff5c57?style=circle'/></a> |
| **green** | SGR foreground code `32` and background code `42` | `#5af78e`&nbsp;<a href='#'><img valign='middle' alt='#5af78e' src='https://readme-swatches.vercel.app/5af78e?style=circle'/></a> |
| **yellow** | SGR foreground code `33` and background code `43` | `#f3f99d`&nbsp;<a href='#'><img valign='middle' alt='#f3f99d' src='https://readme-swatches.vercel.app/f3f99d?style=circle'/></a> |
| **blue** | SGR foreground code `34` and background code `44` | `#57c7ff`&nbsp;<a href='#'><img valign='middle' alt='#57c7ff' src='https://readme-swatches.vercel.app/57c7ff?style=circle'/></a> |
| **magenta** | SGR foreground code `35` and background code `45` | `#d76aff`&nbsp;<a href='#'><img valign='middle' alt='#d76aff' src='https://readme-swatches.vercel.app/d76aff?style=circle'/></a> |
| **cyan** | SGR foreground code `36` and background code `46` | `#9aedfe`&nbsp;<a href='#'><img valign='middle' alt='#9aedfe' src='https://readme-swatches.vercel.app/9aedfe?style=circle'/></a> |
| **white** | SGR foreground code `37` and background code `47` | `#f1f1f0`&nbsp;<a href='#'><img valign='middle' alt='#f1f1f0' src='https://readme-swatches.vercel.app/f1f1f0?style=circle'/></a> |
| **brightBlack** | SGR foreground code `90` and background code `100` | `#686868`&nbsp;<a href='#'><img valign='middle' alt='#686868' src='https://readme-swatches.vercel.app/686868?style=circle'/></a> |
| **brightRed** | SGR foreground code `91` and background code `101` | `#ff5c57`&nbsp;<a href='#'><img valign='middle' alt='#ff5c57' src='https://readme-swatches.vercel.app/ff5c57?style=circle'/></a> |
| **brightGreen** | SGR foreground code `92` and background code `102` | `#5af78e`&nbsp;<a href='#'><img valign='middle' alt='#5af78e' src='https://readme-swatches.vercel.app/5af78e?style=circle'/></a> |
| **brightYellow** | SGR foreground code `93` and background code `103` | `#f3f99d`&nbsp;<a href='#'><img valign='middle' alt='#f3f99d' src='https://readme-swatches.vercel.app/f3f99d?style=circle'/></a> |
| **brightBlue** | SGR foreground code `94` and background code `104` | `#57c7ff`&nbsp;<a href='#'><img valign='middle' alt='#57c7ff' src='https://readme-swatches.vercel.app/57c7ff?style=circle'/></a> |
| **brightMagenta** | SGR foreground code `95` and background code `105` | `#d76aff`&nbsp;<a href='#'><img valign='middle' alt='#d76aff' src='https://readme-swatches.vercel.app/d76aff?style=circle'/></a> |
| **brightCyan** | SGR foreground code `96` and background code `106` | `#9aedfe`&nbsp;<a href='#'><img valign='middle' alt='#9aedfe' src='https://readme-swatches.vercel.app/9aedfe?style=circle'/></a> |
| **brightWhite** | SGR foreground code `97` and background code `107` | `#f1f1f0`&nbsp;<a href='#'><img valign='middle' alt='#f1f1f0' src='https://readme-swatches.vercel.app/f1f1f0?style=circle'/></a> |
| **background** | Terminal window background color | `#282a36`&nbsp;<a href='#'><img valign='middle' alt='#282a36' src='https://readme-swatches.vercel.app/282a36?style=circle'/></a> |
| **iconColor** | Terminal window title icon color | `#d3d7de`&nbsp;<a href='#'><img valign='middle' alt='#d3d7de' src='https://readme-swatches.vercel.app/d3d7de?style=circle'/></a> |
| **text** | Default text color | `#b9c0cb`&nbsp;<a href='#'><img valign='middle' alt='#b9c0cb' src='https://readme-swatches.vercel.app/b9c0cb?style=circle'/></a> |
| **cursorColor** | Cursor color | `#d7d5c9`&nbsp;<a href='#'><img valign='middle' alt='#d7d5c9' src='https://readme-swatches.vercel.app/d7d5c9?style=circle'/></a> |
| **cursorType** | Cursor style, either `'beam'`,  `'block'`, or `'underline'` | `'beam'` |
| **cursorBlink** | Enable cursor blinking | `false` |
| **dim** | Opacity of dim text (styled with SGR code `2`)  | `0.5` |
| **fontFamily** | Font family name | `"'Monaco', 'Cascadia Code', 'Courier New'"` |

## Window Box Shadow

The rendered window box shadow can be configured by passing a configuration object to the [`boxShadow`](#options.boxShadow) option. Any of the options in the table below can be specified, and any unspecified options will assume their default values.

|Option|Description|Default|
|:-----|:----------|:------|
| **dx** | The horizontal offset of the shadow, in pixels. Positive values will offset the shadow to the right of the window, while negative values will offset the shadow to the left. | `0` |
| **dy** | The vertical offset of the shadow, in pixels. Positive values will offset the shadow down under the window, while negative values will offset the shadow up. | `0` |
| **spread** | The spread radius of the shadow. If two numbers are provided in a `[number, number]` array pair, the first number will represent the x-radius of the spread and the second will represent the y-radius. If one `number` is provided, it is used for both the x and y. Positive values will cause the shadow to expand, and negative values will cause the shadow to contract. | `2` |
| **blurRadius** | Blur radius of the shadow. This is the standard deviation value for the blur function, and must be a `number` ≥ 0 | `4` |
| **color** | Color of the shadow. This can be configured with any color `string` or a rgba color array. | `rgba(0, 0, 0, 0.5)` |

## Window Icons

The [`windowIcon`](#options.windowIcon) option can be used to specify an icon to display next to the rendered terminal window title. The following diagram shows the keywords that can be specified to for particular window icons:

<p align="left">
  <a name="diagram.windowIcons" href="#window-icons">
    <img src="media/window-icons.svg" alt="window-icons"/>
  </a>
</p>

## License

[MIT](LICENSE)
