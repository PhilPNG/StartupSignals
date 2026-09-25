import { supabase } from './supabase';
import {
  analyzeCompany,
  CompanyEvidence,
} from './analyze';

export async function runAiEnrichment(
  limit = 5,
  dryRun = false
) {
  // -----------------------------------------
  // 1. Load companies
  // -----------------------------------------

  const {
    data: companies,
    error: companyError,
  } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      city,
      sector,
      website
    `)
    .eq('active', true)
    .limit(limit);

  if (companyError) {
    throw companyError;
  }

  console.log(
    `Found ${companies?.length ?? 0} companies`
  );

  // -----------------------------------------
  // 2. Analyze each company
  // -----------------------------------------

  for (const company of companies ?? []) {
    console.log(`\nAI analysis: ${company.name}`);

    const {
      data: signals,
      error: signalError,
    } = await supabase
      .from('signals')
      .select(`
        source,
        external_id,
        type,
        subtype,
        amount,
        count,
        event_date,
        source_url,
        description
      `)
      .eq('company_id', company.id);

    if (signalError) {
      console.error(
        `  Failed to load signals:`,
        signalError
      );
      continue;
    }

    if (!signals?.length) {
      console.log('  No signals — skipped');
      continue;
    }

    // -----------------------------------------
    // 3. Retrieve rich research evidence
    // -----------------------------------------

    const researchEvidence:
      CompanyEvidence['researchEvidence'] = [];

    for (const signal of signals) {
      // Rich abstracts are most useful for
      // research/grant sources.
      if (
        !['sbir', 'nih', 'nsf'].includes(
          signal.source
        )
      ) {
        continue;
      }

      const {
        data: sourceRecord,
        error: sourceError,
      } = await supabase
        .from('source_records')
        .select(`
          source,
          external_id,
          payload
        `)
        .eq('source', signal.source)
        .eq('external_id', signal.external_id)
        .maybeSingle();

      if (sourceError) {
        console.warn(
          `  Source record lookup failed:`,
          sourceError.message
        );

        continue;
      }

      if (!sourceRecord) {
        continue;
      }

      try {
        const payload =
          typeof sourceRecord.payload === 'string'
            ? JSON.parse(sourceRecord.payload)
            : sourceRecord.payload;

        const raw =
          payload?.raw ?? payload;

        researchEvidence.push({
          source: signal.source,

          title:
            raw?.project_title ??
            raw?.award_title ??
            signal.description ??
            undefined,

          abstract:
            raw?.abstract_text ??
            raw?.abstract ??
            undefined,

          narrative:
            raw?.phr_text ??
            raw?.project_narrative ??
            undefined,
        });
      } catch (error) {
        console.warn(
          `  Could not parse source record`,
          error
        );
      }
    }

    // -----------------------------------------
    // 4. Calculate deterministic metrics
    // -----------------------------------------

    const grantSignals = signals.filter(
      (signal) => signal.type === 'grant'
    );

    const totalGrantAmount =
      grantSignals.reduce(
        (sum, signal) =>
          sum + Number(signal.amount ?? 0),
        0
      );

    const dates = signals
      .map((signal) => signal.event_date)
      .filter(
        (date): date is string =>
          date !== null
      )
      .sort();

    const latestSignalDate =
      dates.length > 0
        ? dates[dates.length - 1]
        : null;

    // -----------------------------------------
    // 5. Build LLM evidence object
    // -----------------------------------------

    const evidence: CompanyEvidence = {
      company: {
        id: company.id,
        name: company.name,
        city: company.city,
        sector: company.sector,
        website: company.website,
      },

      metrics: {
        signalCount: signals.length,
        grantCount: grantSignals.length,
        totalGrantAmount,
        latestSignalDate,
      },

      signals: signals.map((signal) => ({
        source: signal.source,
        type: signal.type,
        subtype: signal.subtype,
        amount:
          signal.amount !== null
            ? Number(signal.amount)
            : null,
        eventDate: signal.event_date,
        description: signal.description,
      })),

      researchEvidence,
    };

    // -----------------------------------------
    // 6. Dry-run mode
    // -----------------------------------------

    if (dryRun) {
      console.dir(evidence, {
        depth: null,
      });

      continue;
    }

    // -----------------------------------------
    // 7. LLM analysis
    // -----------------------------------------

    try {
      const result =
        await analyzeCompany(evidence);

      console.log(
        `  Summary: ${result.summary}`
      );

      // ---------------------------------------
      // 8. Save AI output
      // ---------------------------------------

      const {
        error: writeError,
      } = await supabase
        .from('company_ai_enrichment')
        .upsert(
          {
            company_id: company.id,

            summary:
              result.summary,

            momentum_summary:
              result.momentumSummary,

            key_signals:
              result.keySignals,

            evidence_sources: [
              ...new Set(
                signals.map(
                  (signal) =>
                    signal.source
                )
              ),
            ],

            generated_at:
              new Date().toISOString(),
          },
          {
            onConflict: 'company_id',
          }
        );

      if (writeError) {
        console.error(
          `  Failed to save AI analysis:`,
          writeError
        );

        continue;
      }

      console.log('  ✓ Enriched');
    } catch (error) {
      console.error(
        `  LLM analysis failed:`,
        error
      );
    }
  }
}

// ---------------------------------------------
// CLI
// ---------------------------------------------

const dryRun =
  process.argv.includes('--dry-run');

runAiEnrichment(5, dryRun)
  .then(() => {
    console.log(
      '\nAI enrichment complete'
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      '\nAI enrichment failed:',
      error
    );

    process.exit(1);
  });