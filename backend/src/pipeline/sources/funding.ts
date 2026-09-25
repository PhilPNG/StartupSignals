import fs from 'node:fs';
import { unzipSync } from 'fflate';
import type { RawRecord } from '../types';
import { field, isoDate, localFiles, MissingInputError, money, parseTable } from '../source-utils';

type Row = Record<string, string>;

function table(files: Record<string, Uint8Array>, stem: string): Row[] {
  const entry = Object.entries(files).find(([name]) => name.toUpperCase().endsWith(`${stem}.TSV`));
  if (!entry) throw new Error(`Form D ZIP has no ${stem}.tsv`);
  return parseTable(new TextDecoder().decode(entry[1]), '\t');
}

/** Parse SEC quarterly Form D ZIPs dropped in data/raw/. */
export async function fetchFormD(): Promise<RawRecord[]> {
  const zips = localFiles(/(?:^|_)d\.zip$/i);
  if (zips.length === 0) throw new MissingInputError('Download Form D quarterly ZIPs to backend/data/raw/');
  const offerings = new Map<string, RawRecord & { filingDate: string }>();

  for (const file of zips) {
    const files = unzipSync(fs.readFileSync(file));
    const issuers = new Map(table(files, 'ISSUERS')
      .filter((r) => field(r, 'IS_PRIMARYISSUER_FLAG').toUpperCase() === 'YES')
      .map((r) => [field(r, 'ACCESSIONNUMBER'), r]));
    const submissions = new Map(table(files, 'FORMDSUBMISSION').map((r) => [field(r, 'ACCESSIONNUMBER'), r]));
    for (const offering of table(files, 'OFFERING')) {
      const accession = field(offering, 'ACCESSIONNUMBER');
      const issuer = issuers.get(accession);
      if (!accession || !issuer) continue;
      const state = field(issuer, 'STATEORCOUNTRY', 'ISSUERSTATEORCOUNTRY', 'STATE');
      if (state.toUpperCase() !== 'NJ') continue;
      const zip = field(issuer, 'ZIPCODE');
      if (/^\d{5}/.test(zip) && !/^0[78]/.test(zip)) continue;
      const name = field(issuer, 'ENTITYNAME', 'ISSUERNAME');
      const city = field(issuer, 'CITY', 'ISSUERCITY');
      if (!name || !city) continue;
      const submission = submissions.get(accession) ?? {};
      const cik = field(issuer, 'ISSUERCIK', 'CIK');
      const firstSale = isoDate(field(offering, 'SALE_DATE'));
      const filingDate = isoDate(field(submission, 'FILING_DATE', 'FILINGDATE')) ?? firstSale ?? '';
      if (!filingDate) continue;
      const externalId = cik && firstSale ? `${cik}:${firstSale}` : accession;
      const amount = money(field(offering, 'TOTALAMOUNTSOLD'));
      if (!amount || amount <= 0) continue;
      const incorporated = Number(field(issuer, 'YEAROFINC_VALUE_ENTERED'));
      const record: RawRecord & { filingDate: string } = {
        source: 'sec-form-d', externalId, name, city, state: 'NJ', cik,
        address: [field(issuer, 'STREET1'), field(issuer, 'STREET2')].filter(Boolean).join(', '),
        foundedYear: Number.isInteger(incorporated) && incorporated > 1800 ? incorporated : undefined,
        industryGroup: field(offering, 'INDUSTRYGROUPTYPE'),
        signalType: 'funding', amount, count: 1, date: filingDate,
        sourceUrl: cik
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-', '')}/`
          : 'https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets',
        description: 'SEC Form D reported securities offering',
        raw: { accession, cik, firstSale, filingDate, amountSold: amount,
          investmentFundType: field(offering, 'INVESTMENTFUNDTYPE'), filing: submission, offering },
        filingDate,
      };
      const previous = offerings.get(externalId);
      // Amendments report cumulative sold amount. Keep the latest filing for one offering.
      if (!previous || previous.filingDate < filingDate) offerings.set(externalId, record);
    }
  }
  return [...offerings.values()].map(({ filingDate: _filingDate, ...record }) => record);
}

/** Recent Form D discovery is gated until a verified query and amount parser are available. */
export async function fetchRecentFormD(): Promise<RawRecord[]> {
  throw new MissingInputError('Recent Form D adapter is not enabled; use the quarterly ZIPs');
}
