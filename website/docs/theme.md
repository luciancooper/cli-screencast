---
title: Theme
pagination_next: null
pagination_prev: null
---

# Theme

The terminal theme can be specified by passing a theme configuration object to the [`theme`](options.md#theme) option. One or more of the properties in the table below can be specified, and any unspecified properties will be inherited from the default theme.

> [!note]
> Color values can be configured with any color `string` or a `[number, number, number, number?]` rgba color tuple.

|Property|Description*|Default|
|:-------|:----------|:------|
| **foreground** | Terminal foreground color | [`#e1e4ea`](color:e1e4ea) |
| **background** | Terminal background color | [`#282a36`](color:282a36) |
| **black** | SGR foreground code `30` and background code `40` | [`#000000`](color:000000) |
| **red** | SGR foreground code `31` and background code `41` | [`#e60800`](color:e60800) |
| **green** | SGR foreground code `32` and background code `42` | [`#26a439`](color:26a439) |
| **yellow** | SGR foreground code `33` and background code `43` | [`#cdac08`](color:cdac08) |
| **blue** | SGR foreground code `34` and background code `44` | [`#0066ff`](color:0066ff) |
| **magenta** | SGR foreground code `35` and background code `45` | [`#ca30c7`](color:ca30c7) |
| **cyan** | SGR foreground code `36` and background code `46` | [`#00c5c7`](color:00c5c7) |
| **white** | SGR foreground code `37` and background code `47` | [`#cccccc`](color:cccccc) |
| **brightBlack** | SGR foreground code `90` and background code `100` | [`#464646`](color:464646) |
| **brightRed** | SGR foreground code `91` and background code `101` | [`#ff5c57`](color:ff5c57) |
| **brightGreen** | SGR foreground code `92` and background code `102` | [`#32d74b`](color:32d74b) |
| **brightYellow** | SGR foreground code `93` and background code `103` | [`#ffd60a`](color:ffd60a) |
| **brightBlue** | SGR foreground code `94` and background code `104` | [`#43a8ed`](color:43a8ed) |
| **brightMagenta** | SGR foreground code `95` and background code `105` | [`#ff77ff`](color:ff77ff) |
| **brightCyan** | SGR foreground code `96` and background code `106` | [`#60fdff`](color:60fdff) |
| **brightWhite** | SGR foreground code `97` and background code `107` | [`#f2f2f2`](color:f2f2f2) |
| **iconColor** | Terminal window title icon color | [`#d3d7de`](color:d3d7de) |
| **cursorColor** | Cursor color | [`#d7d5c9`](color:d7d5c9) |
| **cursorStyle** | Cursor style, either `'beam'`,  `'block'`, or `'underline'` | `'beam'` |
| **cursorBlink** | Enable cursor blinking | `false` |
| **dim** | Opacity of dim text (styled with SGR code `2`)  | `0.5` |

## Previewing Themes

You can preview the default theme or your own custom theme by rendering a color test screenshot using the data file available at [https://cli-screenshot.io/files/colortest.yaml](https://cli-screenshot.io/files/colortest.yaml). To do this, use the [`renderData`](renderData.md) method, passing the URL as the first argument. Below is an example of rendering a color test to preview the default theme:

```js result='./assets/theme--default.svg'
import { renderData } from 'cli-screencast';

renderData('https://cli-screencast.io/files/colortest.yaml').then((svg) => {
    // Use or save the generated SVG string here
});
```

Here's an example color test of a custom theme configuration based on the [Material](https://github.com/lysyi3m/macos-terminal-themes#material-download) terminal color scheme:

```js result='./assets/theme--material.svg'
import { renderData } from 'cli-screencast';

renderData('https://cli-screencast.io/files/colortest.yaml', {
    theme: {
        foreground: '#232322',
        background: '#eaeaea',
        black: '#212121',
        red: '#b7141f',
        green: '#457b24',
        yellow: '#f6981e',
        blue: '#134eb2',
        magenta: '#560088',
        cyan: '#0e717c',
        white: '#efefef',
        brightBlack: '#424242',
        brightRed: '#e83b3f',
        brightGreen: '#7aba3a',
        brightYellow: '#ffea2e',
        brightBlue: '#54a4f3',
        brightMagenta: '#aa4dbc',
        brightCyan: '#26bbd1',
        brightWhite: '#d9d9d9',
        iconColor: '#1a1a19',
    },
}).then((svg) => {
    // Use or save the generated SVG string here
});
```
