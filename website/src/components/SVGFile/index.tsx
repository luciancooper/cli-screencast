import type { ComponentProps } from 'react';
import clsx from 'clsx';
import styles from './styles.module.scss';

interface Props extends ComponentProps<'div'> {
    rawSvg: string
    badge?: string
}

export default function SVGFile({
    rawSvg,
    badge,
    children,
    ...props
}: Props) {
    return (
        <div {...props} className={clsx(styles.svgFile, 'svg-file', props.className)}>
            {(children || badge) ? (
                <div className={clsx(styles.svgFileTitle, 'svg-file-title')}>
                    {badge ? <span className='badge'>{badge}</span> : null}
                    {children ? <span className='title-content'>{children}</span> : null}
                </div>
            ) : null}
            <div
                className={clsx(styles.svgFileContent, 'svg-file-content')}
                dangerouslySetInnerHTML={{ __html: rawSvg }}
            />
        </div>
    );
}