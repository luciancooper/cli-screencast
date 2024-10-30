---
title: Window
pagination_next: null
pagination_prev: null
---

# Window Configuration

The following diagram shows how the [`windowIcon`](options.md#windowIcon), [`windowTitle`](options.md#windowTitle), [`offsetX`](options.md#offsetX), [`offsetY`](options.md#offsetY), [`paddingX`](options.md#paddingX), [`paddingY`](options.md#paddingY), [`decorations`](options.md#decorations), [`insetMajor`](options.md#insetMajor), and [`insetMinor`](options.md#insetMinor) options affect the rendered terminal window.

![Window Options](./assets/window-options.svg)

## Title and Icon

The initial window title and icon can be specified using the [`windowTitle`](options.md#windowTitle) and [`windowIcon`](options.md#windowIcon) options. After that, the title and icon can also be configured using these OSC escape sequences:

|Sequence|Description|Example|
|:-------|:----------|:------|
|`ESC]0;[text]BEL`|Set both the window title and icon|`\x1b]0;window title and icon\x07`|
|`ESC]1;[text]BEL`|Set the window icon only|`\x1b]1;icon\x07`|
|`ESC]2;[text]BEL`|Set the window title only|`\x1b]2;window title\x07`|

See the [section below](#title-and-icon-examples) for examples of how to use escape sequences to set the terminal window title and icon.

### Icon Keywords

The following diagram shows the keywords that can be used for particular window icons:

![Window Icons](./assets/window-icons.svg)

### Examples {#title-and-icon-examples}

Here's an example of how escape sequences within the content of a screenshot can overwrite the initial window title and icon:

```js result='./assets/usage--window--title-screenshot.svg'
import { renderScreen } from 'cli-screencast';

// contains an escape sequence that sets the window title and icon to 'node'
const content = '\x1b]0;node\x07Hello World!';

renderScreen(content, {
    columns: 50,
    rows: 10,
    windowTitle: 'Overwritten Title',
}).then((svg) => {
    // svg output string...
});
```

Here's an example of capturing a callback function that changes the window title and icon multiple times by both directly writing escape sequences and by using the [`capture.setTitle`](captureCallback.md#capture.setTitle) convenience function:

```js result='./assets/usage--window--title-callback.svg'
import { captureCallback } from 'cli-screencast';

captureCallback((capture) => {
    process.stdout.write('Hello World!');
    capture.wait(2000); // wait 2s
    // change the title to 'Next Title' and the icon to 'node'
    process.stdout.write('\x1b]2;Next Title\x07' + '\x1b]1;node\x07');
    capture.wait(2000); // wait 2s
    // change only the title to 'Last Title'
    capture.setTitle('Last Title');
    capture.wait(2000); // wait 2s
}, {
    columns: 50,
    rows: 10,
    cursorHidden: true,
    windowTitle: 'Initial Title',
    windowIcon: 'shell',
}).then((svg) => {
    // svg output string...
});
```

## Box Shadow

The rendered window box shadow can be configured by passing a configuration object to the [`boxShadow`](options.md#boxShadow) option. Any of the options in the table below can be specified, and any unspecified options will assume their default values.

|Option|Description*|Default|
|:-----|:----------|:-----:|
| **dx** | The horizontal offset of the shadow, in pixels. Positive values will offset the shadow to the right of the window, while negative values will offset the shadow to the left. | `0` |
| **dy** | The vertical offset of the shadow, in pixels. Positive values will offset the shadow down under the window, while negative values will offset the shadow up. | `0` |
| **spread** | The spread radius of the shadow. If two numbers are provided in a `[number, number]` array pair, the first number will represent the x-radius of the spread and the second will represent the y-radius. If one `number` is provided, it is used for both the x and y. Positive values will cause the shadow to expand, and negative values will cause the shadow to contract. | `2` |
| **blurRadius** | Blur radius of the shadow. This is the standard deviation value for the blur function, and must be a `number` ≥ 0 | `4` |
| **color** | Color of the shadow. This can be configured with any color `string` or a rgba color array. | [`[0,0,0,0.5]`](color:0:0:0:.5) |

### Examples {#box-shadow-examples}

Here's an example of a terminal window rendered with the default box shadow:

```js result='./assets/usage--window--shadow.svg'
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    columns: 50,
    rows: 10,
    windowTitle: 'Box Shadow',
    boxShadow: true,
}).then((svg) => {
    // svg output string...
});
```

Here's an example of a terminal window rendered with an offset box shadow:

```js result='./assets/usage--window--shadow-offset.svg'
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    columns: 50,
    rows: 10,
    windowTitle: 'Box Shadow with Offset',
    boxShadow: { dx: 2, dy: 2 },
}).then((svg) => {
    // svg output string...
});
```
