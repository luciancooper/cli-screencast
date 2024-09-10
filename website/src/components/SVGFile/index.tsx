import type { ComponentProps } from 'react';
import clsx from 'clsx';
import styles from './styles.module.scss';

interface Props extends ComponentProps<'div'> {
    title: string
    rawSvg: string
}

export default function SVGFile({ title, rawSvg, ...props }: Props) {
    return (
        <div {...props} className={clsx(styles.svgFile, 'svg-file', props.className)}>
            {title ? (
                <div className={clsx(styles.svgFileTitle, 'svg-file-title')}>
                    <span>{title}</span>
                </div>
            ) : null}
            <div
                className={clsx(styles.svgFileContent, 'svg-file-content')}
                dangerouslySetInnerHTML={{ __html: rawSvg }}
            />
        </div>
    );
}