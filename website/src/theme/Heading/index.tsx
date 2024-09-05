import { Children, isValidElement, type ReactNode } from 'react';
import clsx from 'clsx';
import { translate } from '@docusaurus/Translate';
import { useThemeConfig } from '@docusaurus/theme-common';
import Link from '@docusaurus/Link';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import type { Props } from '@theme/Heading';
import styles from './styles.module.scss';

interface ExtendedProps extends Props {
    typeData?: ReactNode
    required?: boolean
}

function HeadingContent({
    as: As,
    id,
    typeData,
    required,
    children,
    ...props
}: ExtendedProps): JSX.Element {
    const brokenLinks = useBrokenLinks(),
        { navbar: { hideOnScroll } } = useThemeConfig();
    // create class name
    let className = clsx({ 'typed-header': !!typeData }, props.className);
    // H1 headings do not need an id because they don't appear in the TOC.
    if (As === 'h1' || !id) {
        return (
            <As {...props} className={className || undefined} id={undefined}>
                {typeData ? (
                    <>
                        <span>{children}</span>
                        <span className={clsx('type-data', { required })}>{typeData}</span>
                    </>
                ) : children}
            </As>
        );
    }
    brokenLinks.collectAnchor(id);
    // create anchor title
    const anchorTitle = translate({
        id: 'theme.common.headingLinkTitle',
        message: 'Direct link to {heading}',
        description: 'Title for link to heading',
    }, { heading: typeof children === 'string' ? children : id });
    // extend class name
    className = clsx(
        'anchor',
        hideOnScroll ? styles.anchorWithHideOnScrollNavbar : styles.anchorWithStickyNavbar,
        className,
    );
    // create link element
    const link = <Link className='hash-link' to={`#${id}`} aria-label={anchorTitle} title={anchorTitle}>&#8203;</Link>;
    // return heading element
    return (
        <As {...props} className={className} id={id}>
            {typeData ? (
                <>
                    <span>{children}{link}</span>
                    <span className={clsx('type-data', { required })}>{typeData}</span>
                </>
            ) : <>{children}{link}</>}
        </As>
    );
}

interface MdxHeaderTypeData {
    nodes: ReactNode
    required: boolean
}

// Workaround because it's difficult in MDX v1 to provide a MDX title as props
// See https://github.com/facebook/docusaurus/pull/7152#issuecomment-1145779682
function extractHeaderTypeData(children: ReactNode): { mdxTypeData: MdxHeaderTypeData | undefined, rest: ReactNode } {
    const items = Children.toArray(children),
        typeIndex = items.findIndex((item) => isValidElement(item) && item.type === 'mdxHeaderTypeData');
    // stop if mdxHeaderTypeData was not found
    if (typeIndex < 0) return { mdxTypeData: undefined, rest: children };
    // extract mdxHeaderTypeData from children
    const mdxHeaderWrapper = items.splice(typeIndex, 1)[0] as JSX.Element,
        { children: nodes, required = false } = mdxHeaderWrapper.props as { children: ReactNode, required?: boolean };
    return {
        mdxTypeData: { nodes, required },
        rest: items.length > 0 ? <>{items}</> : null,
    };
}

function processHeadingProps(props: ExtendedProps): ExtendedProps {
    const { mdxTypeData, rest } = extractHeaderTypeData(props.children),
        typeData = props.typeData ?? mdxTypeData?.nodes,
        required = props.required ?? mdxTypeData?.required;
    return {
        ...props,
        ...(typeData && { typeData }),
        ...(typeof required === 'boolean' && { required }),
        children: rest,
    };
}

export default function Heading(unprocessed: ExtendedProps): JSX.Element {
    const props = processHeadingProps(unprocessed);
    return <HeadingContent {...props}/>;
}