import { createLogger, transports, format, type Logger } from 'winston';
import { inspect, type InspectOptions } from 'util';
import { relative, isAbsolute } from 'path';
import { stripAnsi } from 'tty-strings';

const SPLAT = Symbol.for('splat');

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const padder = format.padLevels({ levels });

const colorizer = format.colorize({
    level: true,
    message: false,
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'cyan',
        debug: 'blue',
    },
});

function stackTrace(stack: string, indent = 4) {
    return stripAnsi(stack).trim().split('\n')
        // remove the first line of the stack trace
        .slice(1)
        // dim each item in the stack trace
        .map((l) => `\n${' '.repeat(indent)}\x1b[2m${l.trim()}\x1b[22m`)
        .join('');
}

const inspectOptions: InspectOptions = {
    colors: true,
    depth: 4,
};

/**
 * Custom implementation of the built in node method `formatWithOptions`
 * Recognizes the following printf style format strings: '%s', '%S', '%k', '%O', '%e', '%p'
 */
function printf(message: string, ...splat: any[]) {
    let [str, j, a] = ['', 0, 0];
    for (let i = 0, n = message.length - 1; i < n; i += 1) {
        if (message[i] !== '%') continue;
        i += 1;
        const nxt = message[i];
        if (nxt === '%') {
            str += message.slice(j, i);
            j = i + 1;
            continue;
        }
        if (a < splat.length) {
            let fmt: string;
            switch (nxt) {
                case 's': // '%s' - string no formatting
                    fmt = typeof splat[a] !== 'object' ? String(splat[a]) : inspect(splat[a], { depth: 0 });
                    break;
                case 'S': // '%S' - raw strings (green)
                    fmt = `\x1b[32m'${splat[a]}'\x1b[39m`;
                    break;
                case 'k': // '%k' - keywords (yellow)
                    fmt = `\x1b[33m${splat[a]}\x1b[39m`;
                    break;
                case 'O': // '%O' - objects (colored)
                    fmt = inspect(splat[a], inspectOptions);
                    break;
                case 'p': // '%p' - format relative path (cyan)
                    if (typeof splat[a] === 'string') {
                        const path = relative(process.cwd(), splat[a]);
                        if (path) {
                            fmt = path.replace(/\\/g, '/');
                            if (!isAbsolute(path) && !/^\.+\//.test(fmt)) fmt = `./${fmt}`;
                        } else fmt = '.';
                    } else fmt = String(splat[a]);
                    fmt = `\x1b[36m${fmt}\x1b[39m`;
                    break;
                case 'e': // '%e' - errors (colored)
                    if (splat[a] && typeof splat[a] === 'object' && (splat[a] as { error?: Error }).error?.stack) {
                        const { error } = (splat[a] as unknown as { error: Error });
                        fmt = `\x1b[31m${error.message}\x1b[39m${stackTrace(error.stack!)}`;
                        if (i < message.length - 1 || a < splat.length - 1) fmt += '\n';
                    } else fmt = inspect(splat[a], inspectOptions);
                    break;
                default:
                    continue;
            }
            a += 1;
            if (j < i - 1) str += message.slice(j, i - 1);
            str += fmt;
            j = i + 1;
        }
    }
    if (j < message.length) str += message.slice(j);
    // append remaining splat args
    for (; a < splat.length; a += 1) {
        str += ` ${typeof splat[a] !== 'string' ? inspect(splat[a], inspectOptions) : splat[a]}`;
    }
    return str;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';

// global log level
let logLevel: LogLevel = 'warn';

const logger = createLogger({
    levels,
    level: logLevel,
    format: format.combine(
        format.metadata({ key: 'meta' }),
        format.errors({ stack: true }),
        format.printf((info) => {
            // if splat args are present, format message as a printf-like format string
            if (info[SPLAT]) info.message = printf(info.message, ...info[SPLAT]);
            // align message with level prefixes
            padder.transform(info);
            // put level prefix in brackets and colorize
            info.level = `[${info.level}]`;
            colorizer.transform(info, colorizer.options);
            // format final message
            let msg = `${info.level}${info.message}`;
            // format error stack trace if present
            if ((info as { stack?: string }).stack) msg += stackTrace((info as { stack?: string }).stack!);
            return msg;
        }),
    ),
    transports: [new transports.Console()],
});

Object.defineProperty(logger, 'printf', { value: printf });

export interface LoggingOptions {
    /**
     * Control how much info is logged to the console during the render process
     * Options are (in order of decending verbosity): 'debug', 'info', 'warn', 'error', and 'silent'
     * @defaultValue 'warn'
     */
    logLevel?: LogLevel
}

/**
 * Set global log level
 * @param level - global log level to set
 */
export function setLogLevel(level: LogLevel) {
    logLevel = level;
    logger.level = logLevel;
}

/**
 * Resets back to the global log level
 */
export function resetLogLevel() {
    logger.level = logLevel;
}

export function applyLoggingOptions({ logLevel: lvl }: LoggingOptions) {
    // set log level
    logger.level = lvl ?? logLevel;
}

export default logger as Logger & { printf: (message: string, ...splat: any[]) => string };