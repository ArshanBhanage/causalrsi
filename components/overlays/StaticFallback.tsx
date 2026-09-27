'use client';

import { ARCHITECTURE_NOTES, ILLUSTRATIVE, SITE } from '@/content/site';
import {
  AGENT_0042,
  AGENT_0043,
  ATTRIBUTION,
  LINEAGE,
  formatDelta,
  formatScore,
} from '@/lib/causalSimulation';
import styles from './Overlays.module.css';

/**
 * Not a degraded page. This is the instrument's semantic shadow: it is always in the document so
 * assistive technology and non-WebGL visitors read the same content, and it is revealed verbatim
 * when the canvas cannot run.
 */
export function StaticFallback({ visible }: { readonly visible: boolean }) {
  return (
    <main
      id="observatory-content"
      className={visible ? styles.fallback : styles.fallbackHidden}
      aria-hidden={visible ? undefined : true}
    >
      <header className={styles.section}>
        <h1 className={styles.title}>{SITE.project}</h1>
        <p className={styles.tagline}>{SITE.tagline}</p>
        <p className={styles.text}>{SITE.shortDescription}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.label}>Research question</h2>
        <p className={styles.text}>{SITE.researchQuestion}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>The problem</h2>
        <p className={styles.text}>{SITE.longDescription}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Approach</h2>
        <p className={styles.text}>{SITE.approach}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Status</h2>
        <p className={styles.text}>{SITE.status}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Architecture</h2>
        <ul className={styles.list}>
          {ARCHITECTURE_NOTES.map((note) => (
            <li key={note.key}>
              <p className={styles.label}>{note.key}</p>
              <p className={styles.text}>{note.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>{`Demonstration values \u2014 ${ILLUSTRATIVE}`}</h2>
        <p className={styles.text}>
          The interactive experience uses the figures below. They are demonstration data for a
          deterministic toy model and are not experimental results.
        </p>
        <table className={styles.dataTable}>
          <caption className={styles.label}>Agent scores</caption>
          <tbody>
            <tr>
              <th scope="row">{AGENT_0042.id}</th>
              <td>{formatScore(AGENT_0042.score)}</td>
            </tr>
            <tr>
              <th scope="row">{AGENT_0043.id}</th>
              <td>{formatScore(AGENT_0043.score)}</td>
            </tr>
            <tr>
              <th scope="row">Difference</th>
              <td>{formatDelta(ATTRIBUTION.totalDelta)}</td>
            </tr>
          </tbody>
        </table>

        <table className={styles.dataTable}>
          <caption className={styles.label}>Attribution</caption>
          <tbody>
            {ATTRIBUTION.contributions.map((c) => (
              <tr key={c.component}>
                <th scope="row">{c.component}</th>
                <td>{formatDelta(c.value, 2)}</td>
              </tr>
            ))}
            {ATTRIBUTION.interactions.map((i) => (
              <tr key={i.pair.join('-')}>
                <th scope="row">{`${i.pair[0]} x ${i.pair[1]}`}</th>
                <td>{formatDelta(i.value, 2)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Residual / unexplained</th>
              <td>{formatDelta(ATTRIBUTION.residual)}</td>
            </tr>
          </tbody>
        </table>

        <table className={styles.dataTable}>
          <caption className={styles.label}>Candidate lineage</caption>
          <tbody>
            {LINEAGE.map((record) => (
              <tr key={record.id}>
                <th scope="row">{record.id}</th>
                <td>{formatScore(record.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Operators</h2>
        <ul className={styles.list}>
          {SITE.team.map((member) => (
            <li key={member.name} className={styles.text}>
              {`${member.name} \u2014 ${member.role}`}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Source</h2>
        <a className={styles.channel} href={SITE.github} rel="noreferrer noopener" target="_blank">
          {'SOURCE github \u2197'}
        </a>
        {SITE.email ? (
          <a className={styles.channel} href={`mailto:${SITE.email}`}>
            {'OPEN CHANNEL'}
          </a>
        ) : null}
      </section>
    </main>
  );
}
