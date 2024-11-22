import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import ProjectTitle from '@site/static/assets/project-title.svg';
import styles from './index.module.scss';

export default function Home(): JSX.Element {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout description={siteConfig.tagline}>
            <header className={clsx('hero hero--primary', styles.heroBanner)}>
                <Head>
                    <title>{siteConfig.title} {siteConfig.titleDelimiter} {siteConfig.tagline}</title>
                </Head>
                <div className='container padding-horiz--none'>
                    <h1 className='hero__title'>
                        <ProjectTitle className={styles.projectTitle} role='img'/>
                    </h1>
                    <p className='hero__subtitle padding-horiz--md'>{siteConfig.tagline}</p>
                    <div className={clsx('padding-horiz--md', styles.buttons)}>
                        <Link className='button button--secondary button--lg' to='/introduction'>Docs</Link>
                    </div>
                </div>
            </header>
            <main>
                <HomepageFeatures/>
            </main>
        </Layout>
    );
}