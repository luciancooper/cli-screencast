---
title: Theme
pagination_next: null
pagination_prev: null
---

# Theme

The terminal theme can be specified by passing a theme configuration object to the [`theme`](options.md#theme) option. One or more of the properties in the table below can be specified, and any unspecified properties will be inherited from the default theme.

> [!note]
> Color values can be configured with any color `string` or a `[number, number, number, number?]` rgba color tuple.

|Property|Description|Default|
|:-------|:----------|:------|
| **black** | SGR foreground code `30` and background code `40` | [`#000000`](color:000000) |
| **red** | SGR foreground code `31` and background code `41` | [`#ff5c57`](color:ff5c57) |
| **green** | SGR foreground code `32` and background code `42` | [`#5af78e`](color:5af78e) |
| **yellow** | SGR foreground code `33` and background code `43` | [`#f3f99d`](color:f3f99d) |
| **blue** | SGR foreground code `34` and background code `44` | [`#57c7ff`](color:57c7ff) |
| **magenta** | SGR foreground code `35` and background code `45` | [`#d76aff`](color:d76aff) |
| **cyan** | SGR foreground code `36` and background code `46` | [`#9aedfe`](color:9aedfe) |
| **white** | SGR foreground code `37` and background code `47` | [`#f1f1f0`](color:f1f1f0) |
| **brightBlack** | SGR foreground code `90` and background code `100` | [`#686868`](color:686868) |
| **brightRed** | SGR foreground code `91` and background code `101` | [`#ff5c57`](color:ff5c57) |
| **brightGreen** | SGR foreground code `92` and background code `102` | [`#5af78e`](color:5af78e) |
| **brightYellow** | SGR foreground code `93` and background code `103` | [`#f3f99d`](color:f3f99d) |
| **brightBlue** | SGR foreground code `94` and background code `104` | [`#57c7ff`](color:57c7ff) |
| **brightMagenta** | SGR foreground code `95` and background code `105` | [`#d76aff`](color:d76aff) |
| **brightCyan** | SGR foreground code `96` and background code `106` | [`#9aedfe`](color:9aedfe) |
| **brightWhite** | SGR foreground code `97` and background code `107` | [`#f1f1f0`](color:f1f1f0) |
| **background** | Terminal window background color | [`#282a36`](color:282a36) |
| **iconColor** | Terminal window title icon color | [`#d3d7de`](color:d3d7de) |
| **text** | Default text color | [`#b9c0cb`](color:b9c0cb) |
| **cursorColor** | Cursor color | [`#d7d5c9`](color:d7d5c9) |
| **cursorType** | Cursor style, either `'beam'`,  `'block'`, or `'underline'` | `'beam'` |
| **cursorBlink** | Enable cursor blinking | `false` |
| **dim** | Opacity of dim text (styled with SGR code `2`)  | `0.5` |
