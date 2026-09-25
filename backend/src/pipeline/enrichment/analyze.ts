import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type CompanyEvidence = {
  company: {
    id: string;
    name: string;
    city?: string | null;
    sector?: string | null;
    website?: string | null;
  };

  metrics: {
    signalCount: number;
    grantCount: number;
    totalGrantAmount: number;
    latestSignalDate: string | null;
  };

  signals: Array<{
    source: string;
    type: string;
    subtype?: string | null;
    amount?: number | null;
    eventDate?: string | null;
    description?: string | null;
  }>;

  researchEvidence: Array<{
    source: string;
    title?: string;
    abstract?: string;
    narrative?: string;
  }>;
};

export type CompanyAnalysis = {
  summary: string;
  momentumSummary: string;
  keySignals: string[];
};

export async function analyzeCompany(
  evidence: CompanyEvidence
): Promise<CompanyAnalysis> {
  const response = await openai.responses.create({
    model: 'gpt-5.6',

    instructions: SYSTEM_PROMPT,

    input: JSON.stringify(evidence),

    text: {
      format: {
        type: 'json_schema',
        name: 'company_intelligence',
        strict: true,

        schema: {
          type: 'object',

          properties: {
            summary: {
              type: 'string',
            },

            momentumSummary: {
              type: 'string',
            },

            keySignals: {
              type: 'array',
              items: {
                type: 'string',
              },
              maxItems: 4,
            },
          },

          required: [
            'summary',
            'momentumSummary',
            'keySignals',
          ],

          additionalProperties: false,
        },
      },
    },
  });

  return JSON.parse(
    response.output_text
  ) as CompanyAnalysis;
}