---
title: Fonts
pagination_next: null
pagination_prev: null
---

# Fonts

To ensure portability, this package extracts font subsets from locally installed fonts on your machine and embeds them directly into generated SVG files. This makes the SVG self-contained so that your chosen font will render consistently across different browsers and environments, which is especially useful for users who rely on customized fonts like [**Nerd Fonts**](https://www.nerdfonts.com) in their personalized terminal configurations. With embedded fonts, your SVG captures will preserve the exact appearance of your terminal, even if the viewer's system doesn't have the required fonts installed.

> [!note]
> Fonts are embedded into output SVG files by default, but if you prefer to reduce the size of your SVG or don't need font embedding, you can disable this behavior by setting the [`embedFonts`](options.md#embedFonts) option to `false`.

## Column Width and Line Height

By default, the renderer analyzes the horizontal metrics of the specified font family to calculate the width to font-size aspect ratio for each terminal column. This ensures accurate text layout and correct cursor placement.

For example, [**Ubuntu Mono**](https://fonts.google.com/specimen/Ubuntu+Mono) (shown below on the left) is a narrow monospaced font with a width-to-height ratio of `0.5`, while [**Azeret Mono**](https://fonts.google.com/specimen/Azeret+Mono) (shown below on the right) is a wide monospaced font with a width-to-height ratio of `0.65`:

|*|*|
|-|-|
| ![UbuntuMono](./assets/font-sample-UbuntuMono.svg) | ![AzeretMono](./assets/font-sample-AzeretMono.svg) |

If you want to override this behavior, you can directly specify a column width aspect ratio using the [`columnWidth`](options.md#columnWidth) option.

Line height is not detected from the font and defaults to 1.2, but it can be customized using the [`lineHeight`](options.md#lineHeight) option.

## Supplying Additional Fonts

The [`fonts`](options.md#fonts) option lets you provide an array of additional font files (either local or remote) to supplement those that are already installed on your machine. This is particularly useful in environments such as CI pipelines, where you may not have control over which fonts are locally installed. By supplying fonts directly, you ensure that your terminal captures render with the correct typography, regardless of the environment.

Here's an example of a terminal screenshot that contains nerd font icon glyphs, rendered with the [Cascadia Code NF](https://github.com/microsoft/cascadia-code) font family. The `fonts` option is used to supply a remote URL that points to a copy of the font file, which is stored in an Amazon S3 bucket.

```js result='./assets/usage--fonts.svg'
import { renderScreen } from 'cli-screencast';

// terminal prompt string that uses nerd font icon glyphs
const prompt = '\uf31b \x1b[36m~/..\ue5fe../project\x1b[39;32m \ue725 main\x1b[39m \uf105 ';

renderScreen(prompt, {
    columns: 80,
    rows: 10,
    // show a blinking cursor
    cursorHidden: false,
    theme: { cursorStyle: 'underline', cursorBlink: true },
    // specify Cascadia Code Nerd Font and provide a remote font file
    fontFamily: 'Cascadia Code NF',
    fonts: [
        'https://fontlib.s3.amazonaws.com/CascadiaCode/CascadiaCodeNF.ttf',
    ],
}).then((svg) => {
    // svg output string...
});
```
