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
| **black** | SGR foreground code `30` and background code `40` | `#000000`&nbsp;<img valign='middle' alt='#000000' src='https://readme-swatches.vercel.app/000000?style=circle'/> |
| **red** | SGR foreground code `31` and background code `41` | `#ff5c57`&nbsp;<img valign='middle' alt='#ff5c57' src='https://readme-swatches.vercel.app/ff5c57?style=circle'/> |
| **green** | SGR foreground code `32` and background code `42` | `#5af78e`&nbsp;<img valign='middle' alt='#5af78e' src='https://readme-swatches.vercel.app/5af78e?style=circle'/> |
| **yellow** | SGR foreground code `33` and background code `43` | `#f3f99d`&nbsp;<img valign='middle' alt='#f3f99d' src='https://readme-swatches.vercel.app/f3f99d?style=circle'/> |
| **blue** | SGR foreground code `34` and background code `44` | `#57c7ff`&nbsp;<img valign='middle' alt='#57c7ff' src='https://readme-swatches.vercel.app/57c7ff?style=circle'/> |
| **magenta** | SGR foreground code `35` and background code `45` | `#d76aff`&nbsp;<img valign='middle' alt='#d76aff' src='https://readme-swatches.vercel.app/d76aff?style=circle'/> |
| **cyan** | SGR foreground code `36` and background code `46` | `#9aedfe`&nbsp;<img valign='middle' alt='#9aedfe' src='https://readme-swatches.vercel.app/9aedfe?style=circle'/> |
| **white** | SGR foreground code `37` and background code `47` | `#f1f1f0`&nbsp;<img valign='middle' alt='#f1f1f0' src='https://readme-swatches.vercel.app/f1f1f0?style=circle'/> |
| **brightBlack** | SGR foreground code `90` and background code `100` | `#686868`&nbsp;<img valign='middle' alt='#686868' src='https://readme-swatches.vercel.app/686868?style=circle'/> |
| **brightRed** | SGR foreground code `91` and background code `101` | `#ff5c57`&nbsp;<img valign='middle' alt='#ff5c57' src='https://readme-swatches.vercel.app/ff5c57?style=circle'/> |
| **brightGreen** | SGR foreground code `92` and background code `102` | `#5af78e`&nbsp;<img valign='middle' alt='#5af78e' src='https://readme-swatches.vercel.app/5af78e?style=circle'/> |
| **brightYellow** | SGR foreground code `93` and background code `103` | `#f3f99d`&nbsp;<img valign='middle' alt='#f3f99d' src='https://readme-swatches.vercel.app/f3f99d?style=circle'/> |
| **brightBlue** | SGR foreground code `94` and background code `104` | `#57c7ff`&nbsp;<img valign='middle' alt='#57c7ff' src='https://readme-swatches.vercel.app/57c7ff?style=circle'/> |
| **brightMagenta** | SGR foreground code `95` and background code `105` | `#d76aff`&nbsp;<img valign='middle' alt='#d76aff' src='https://readme-swatches.vercel.app/d76aff?style=circle'/> |
| **brightCyan** | SGR foreground code `96` and background code `106` | `#9aedfe`&nbsp;<img valign='middle' alt='#9aedfe' src='https://readme-swatches.vercel.app/9aedfe?style=circle'/> |
| **brightWhite** | SGR foreground code `97` and background code `107` | `#f1f1f0`&nbsp;<img valign='middle' alt='#f1f1f0' src='https://readme-swatches.vercel.app/f1f1f0?style=circle'/> |
| **background** | Terminal window background color | `#282a36`&nbsp;<img valign='middle' alt='#282a36' src='https://readme-swatches.vercel.app/282a36?style=circle'/> |
| **iconColor** | Terminal window title icon color | `#d3d7de`&nbsp;<img valign='middle' alt='#d3d7de' src='https://readme-swatches.vercel.app/d3d7de?style=circle'/> |
| **text** | Default text color | `#b9c0cb`&nbsp;<img valign='middle' alt='#b9c0cb' src='https://readme-swatches.vercel.app/b9c0cb?style=circle'/> |
| **cursorColor** | Cursor color | `#d7d5c9`&nbsp;<img valign='middle' alt='#d7d5c9' src='https://readme-swatches.vercel.app/d7d5c9?style=circle'/> |
| **cursorType** | Cursor style, either `'beam'`,  `'block'`, or `'underline'` | `'beam'` |
| **cursorBlink** | Enable cursor blinking | `false` |
| **dim** | Opacity of dim text (styled with SGR code `2`)  | `0.5` |
