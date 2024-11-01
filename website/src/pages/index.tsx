import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.scss';

export default function Home(): JSX.Element {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout description={siteConfig.tagline}>
            <header className={clsx('hero hero--primary', styles.heroBanner)}>
                <Head>
                    <title>{siteConfig.title} {siteConfig.titleDelimiter} {siteConfig.tagline}</title>
                </Head>
                <div className='container'>
                    <Heading as='h1' className='hero__title'>{siteConfig.title}</Heading>
                    <p className='hero__subtitle'>{siteConfig.tagline}</p>
                    <div className={styles.buttons}>
                        <Link className='button button--secondary button--lg' to='/introduction'>Docs</Link>
                    </div>
                </div>
            </header>
        </Layout>
    );
}