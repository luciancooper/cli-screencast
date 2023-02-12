const unicodeEncoding = ['utf-16be', 'utf-16be', 'utf-16be', 'utf-16be', 'utf-16be', 'utf-16be', 'utf-16be'];

const macLanguageEncodings = new Map<number, string>([
    [15, 'x-mac-icelandic'], [17, 'x-mac-turkish'], [18, 'x-mac-croatian'], [24, 'x-mac-ce'], [25, 'x-mac-ce'],
    [26, 'x-mac-ce'], [27, 'x-mac-ce'], [28, 'x-mac-ce'], [30, 'x-mac-icelandic'], [37, 'x-mac-romanian'],
    [38, 'x-mac-ce'], [39, 'x-mac-ce'], [40, 'x-mac-ce'], [143, 'x-mac-inuit'], [146, 'x-mac-gaelic'],
]);

const macScriptEncodings = new Map<number, string>([
    [0, 'x-mac-roman'], [1, 'shift-jis'], [2, 'big5'], [3, 'euc-kr'], [4, 'iso-8859-6'], [5, 'iso-8859-8'],
    [6, 'x-mac-greek'], [7, 'x-mac-cyrillic'], [8, 'x-mac-symbol'], [9, 'x-mac-devanagari'], [10, 'x-mac-gurmukhi'],
    [11, 'x-mac-gujarati'], [12, 'x-mac-oriya'], [13, 'x-mac-bengali'], [14, 'x-mac-tamil'], [15, 'x-mac-telugu'],
    [16, 'x-mac-kannada'], [17, 'x-mac-malayalam'], [18, 'x-mac-sinhalese'], [19, 'x-mac-burmese'],
    [20, 'x-mac-khmer'], [21, 'iso-8859-11'], [22, 'x-mac-lao'], [23, 'x-mac-georgian'], [24, 'x-mac-armenian'],
    [25, 'gbk'], [26, 'x-mac-tibetan'], [27, 'x-mac-mongolian'], [28, 'x-mac-ethiopic'], [29, 'x-mac-ce'],
    [30, 'x-mac-vietnamese'], [31, 'x-mac-extarabic'],
]);

const windowsEncoding = ['symbol', 'utf-16be', 'shift-jis', 'gb18030', 'big5', 'euc-kr', 'johab',,,, 'utf-16be'];

export function getEncoding(platformID: number, encodingID: number, languageID: number) {
    let enc: string | undefined;
    switch (platformID) {
        case 0:
            enc = unicodeEncoding[encodingID];
            break;
        case 1:
            enc = macLanguageEncodings.get(languageID) ?? macScriptEncodings.get(encodingID);
            break;
        case 2:
            enc = ['ascii', , 'iso-8859-1'][encodingID];
            break;
        case 3:
            // http://msdn.microsoft.com/en-us/library/system.text.encoding(v=vs.110).aspx
            enc = windowsEncoding[encodingID];
            break;
        // no default
    }
    return enc ?? 'ascii';
}