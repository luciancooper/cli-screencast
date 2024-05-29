import { createLogger, transports, format } from 'winston';
import { formatWithOptions, type InspectOptions } from 'util';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';

const transport = new transports.Console({
    level: 'info',
});

export function setLogLevel(level: LogLevel) {
    transport.level = level;
}

export interface LoggingOptions {
    /**
     * Control how much info is logged to the console during the render process
     * Options are (in order of decending verbosity): 'debug', 'info', 'warn', 'error', and 'silent'
     * @defaultValue 'info'
     */
    logLevel?: LogLevel
}

export function applyLoggingOptions({ logLevel }: LoggingOptions) {
    setLogLevel(logLevel ?? 'info');
}

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

const inspectOptions: InspectOptions = {
    colors: true,
    depth: 4,
};

export default createLogger({
    levels,
    format: format.combine(
        format.metadata({ key: 'meta' }),
        format.errors({ stack: true }),
        format.printf((info) => {
            if (info[SPLAT]) {
                // format message with color
                info.message = formatWithOptions(inspectOptions, info.message, ...info[SPLAT]);
            }
            // align message with level prefixes
            padder.transform(info, padder.options);
            // put level prefix in brackets and colorize
            info.level = `[${info.level}]`;
            colorizer.transform(info, colorizer.options);
            // format final message
            let msg = `${info.level}${info.message}`;
            // check for error stack trace
            if ((info as { stack?: string }).stack) {
                const stack: string[] = (info as unknown as { stack: string }).stack
                    // remove the first line of the stack trace
                    .trim().split('\n').slice(1);
                // append dimmed stack trace to the output message
                msg += stack.map((l) => `\n  \x1b[2m${l}\x1b[22m`).join('');
            }
            return msg;
        }),
    ),
    transports: [transport],
});