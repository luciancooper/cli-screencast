---
title: Output
pagination_next: null
pagination_prev: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Output

This package provides flexible control over how captured terminal output is returned or saved. This is done through two key options: [`output`](options.md#output) and [`outputPath`](options.md#outputPath). These options let you control how the output is returned programmatically, and give you the ability to save it directly to a file in different formats. Supported output formats include **SVG**, **PNG**, **JSON**, and **YAML**.

> [!warning]
> Rendering longer terminal captures to **PNG** can be slow, so it's recommended to first save captures as a **JSON** or **YAML** data file (more about this below) and then use the [`renderData`](renderData.md) method on that file to generate the **PNG**.
>
> When rendering to **PNG**, you can set the [`logLevel`](options.md#logLevel) option to `'info'` or higher to receive progress updates.

## The `output` option

The [`output`](options.md#output) option controls the returned output format of each function in the API, which is useful when you need to further process or manipulate the output in memory. It defaults to `'svg'`, but you can alternatively specify `'png'`, `'json'`, or `'yaml'` (`'yml'` is accepted as an alias for `'yaml'`).

**Example:**

<Tabs>
<TabItem value="svg">

```js
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    output: 'svg',
    columns: 50,
    rows: 10,
}).then((string) => {
    // Handle SVG string here
});
```

</TabItem>
<TabItem value="png">

```js
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    output: 'png',
    columns: 50,
    rows: 10,
}).then((buffer) => {
    // Handle PNG buffer here
});
```

</TabItem>
<TabItem value="json">

```js
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    output: 'json',
    columns: 50,
    rows: 10,
}).then((string) => {
    // Handle JSON string here
});
```

</TabItem>
<TabItem value="yaml">

```js
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    output: 'yaml',
    columns: 50,
    rows: 10,
}).then((string) => {
    // Handle YAML string here
});
```

</TabItem>
</Tabs>

## The `outputPath` option

The [`outputPath`](options.md#outputPath) option allows you to directly save the output to a file in a specified format. The file format (**SVG**, **PNG**, **JSON**, or **YAML**) is automatically inferred from the file extension provided in each path (e.g., `.svg`, `.png`, `.json`, `.yaml`, or `.yml`). Paths that are not absolute are resolved relative to the current working directory.

The following example demonstrates how to save a capture in all four formats, each to its respective output file:

```js
import { captureFrames } from 'cli-screencast';

const frames = [
    { content: 'Hello', duration: 1500 },
    { content: ' World!', duration: 1500 },
];

captureFrames(frames, {
    columns: 50,
    rows: 10,
    // Save capture in multiple formats simultaneously
    outputPath: [
        './capture.svg',
        './capture.png',
        './capture.json',
        './capture.yaml',
    ],
});
```

The four resulting files are saved to the current working directory:

<Tabs className='result-file-tabs'>
<TabItem value='svg' label='capture.svg'>

![./capture.svg](./assets/usage--output--capture.svg)

</TabItem>
<TabItem value='png' label='capture.png'>

![./capture.png](./assets/usage--output--capture.png)

</TabItem>
<TabItem value='json' label='capture.json'>

![](./assets/usage--output--capture.json)

</TabItem>
<TabItem value='yaml' label='capture.yaml'>

![](./assets/usage--output--capture.yaml)

</TabItem>
</Tabs>

### Combined Usage

You can use both the `outputPath` and `output` options together. For example, you might want to programmatically get the **SVG** string for further manipulation, while simultaneously saving the output as a PNG file:

```js
import { renderScreen } from 'cli-screencast';

renderScreen('Hello World!', {
    output: 'svg',
    // Save capture directly as a PNG file
    outputPath: './screenshot.png',
    columns: 50,
    rows: 10,
}).then((string) => {
    // Use the generated SVG string here
});
```
