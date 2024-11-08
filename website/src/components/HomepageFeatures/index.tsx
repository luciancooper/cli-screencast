import clsx from 'clsx';
import FeatureCapture from '@site/static/assets/feature-capture.svg';
import FeatureCustomize from '@site/static/assets/feature-customize.svg';
import FeatureExport from '@site/static/assets/feature-export.svg';
import styles from './styles.module.scss';

interface FeatureItem {
    title: string
    Svg: React.ComponentType<React.ComponentProps<'svg'>>
    description: JSX.Element
}

const FeatureList: FeatureItem[] = [
    {
        title: 'Capture Terminal Sessions',
        Svg: FeatureCapture,
        description: (
            <>
                Capture terminal screenshots and recordings from subprocesses,
                shell sessions, frame arrays, and Node.js code.
            </>
        ),
    },
    {
        title: 'Customize Rendering',
        Svg: FeatureCustomize,
        description: (
            <>
                Adjust terminal themes, integrate custom fonts, and tailor window dimensions for precise,
                personalized renderings of your terminal output.
            </>
        ),
    },
    {
        title: 'Export to SVG or PNG',
        Svg: FeatureExport,
        description: (
            <>
                Export captures to high-resolution SVG or PNG images, ensuring clean,
                professional visuals for sharing or documentation.
            </>
        ),
    },
];

function Feature({ title, Svg, description }: FeatureItem) {
    return (
        <div className={clsx('col col--4')}>
            <div className='text--center'>
                <Svg className={styles.featureSvg} role='img'/>
            </div>
            <div className='text--center padding-horiz--md'>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}

export default function HomepageFeatures(): JSX.Element {
    return (
        <section className={styles.features}>
            <div className='container'>
                <div className='row'>
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props}/>
                    ))}
                </div>
            </div>
        </section>
    );
}