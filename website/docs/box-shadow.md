---
title: Window Box Shadow
pagination_next: null
pagination_prev: null
---

# Window Box Shadow

The rendered window box shadow can be configured by passing a configuration object to the [`boxShadow`](options.md#boxShadow) option. Any of the options in the table below can be specified, and any unspecified options will assume their default values.

|Option|Description|Default|
|:-----|:----------|:-----:|
| **dx** | The horizontal offset of the shadow, in pixels. Positive values will offset the shadow to the right of the window, while negative values will offset the shadow to the left. | `0` |
| **dy** | The vertical offset of the shadow, in pixels. Positive values will offset the shadow down under the window, while negative values will offset the shadow up. | `0` |
| **spread** | The spread radius of the shadow. If two numbers are provided in a `[number, number]` array pair, the first number will represent the x-radius of the spread and the second will represent the y-radius. If one `number` is provided, it is used for both the x and y. Positive values will cause the shadow to expand, and negative values will cause the shadow to contract. | `2` |
| **blurRadius** | Blur radius of the shadow. This is the standard deviation value for the blur function, and must be a `number` ≥ 0 | `4` |
| **color** | Color of the shadow. This can be configured with any color `string` or a rgba color array. | `rgba(0, 0, 0, 0.5)` |
