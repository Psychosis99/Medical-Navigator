/**
 * Reads the pipe-delimited seed rows straight out of SeedData.java so the UI
 * test runs against the same dataset that ships in the APK. Keeping one source
 * of truth means a seed change cannot silently break the tests' realism.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SEED = path.join(__dirname, '../../app/src/main/java/com/mednav/navigator/SeedData.java');

const COLUMNS = {
  HOSPITALS: ['id', 'name', 'city', 'area', 'type', 'address', 'phone', 'distance_km',
    'beds', 'cashless', 'rating', 'rating_count', 'abdm', 'emergency'],
  DOCTORS: ['id', 'name', 'specialty', 'qualification', 'exp_years', 'city', 'hospital_id',
    'languages', 'opd_fee_min', 'opd_fee_max', 'tele_fee', 'rating', 'rating_count',
    'insurers', 'next_slot', 'govt_scheme', 'bio'],
  TESTS: ['code', 'name', 'typical_min', 'typical_max', 'fasting', 'note'],
  LABS: ['id', 'name', 'city', 'discount', 'home_collection', 'rating', 'phone', 'nabl'],
  LAB_TESTS: ['lab_id', 'test_code', 'price'],
  INSURERS: ['id', 'name', 'kind', 'tpa', 'helpline', 'note'],
  POLICY_CLAUSES: ['insurer_id', 'plan', 'kind', 'heading', 'body'],
  CONDITIONS: ['id', 'label', 'specialty', 'tests', 'red_flags', 'keywords'],
  CHAT_RULES: ['specialty', 'keywords', 'reply'],
  CONSULTANTS: ['id', 'name', 'role', 'title', 'qualification', 'specialty',
    'exp_years', 'languages', 'hours', 'sla', 'fee_note', 'rating', 'rating_count',
    'helps_with', 'bio', 'email'],
  CONSULT_TOPICS: ['id', 'label', 'role', 'hint']
};

const NUMERIC = new Set(['distance_km', 'beds', 'rating', 'rating_count', 'abdm', 'emergency',
  'exp_years', 'opd_fee_min', 'opd_fee_max', 'tele_fee', 'govt_scheme', 'typical_min',
  'typical_max', 'fasting', 'discount', 'home_collection', 'nabl', 'price']);

function parse() {
  const src = fs.readFileSync(SEED, 'utf8');
  const out = {};
  for (const name of Object.keys(COLUMNS)) {
    const start = src.indexOf(`String[] ${name} = {`);
    if (start < 0) throw new Error(`seed array ${name} not found`);
    const open = src.indexOf('{', start);
    const close = src.indexOf('};', open);
    const body = src.slice(open + 1, close);

    const rows = [];
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      rows.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
    }
    const cols = COLUMNS[name];
    out[name] = rows.map((row, i) => {
      const parts = row.split('|');
      if (parts.length !== cols.length) {
        throw new Error(`${name} row ${i}: ${parts.length} fields, expected ${cols.length}`);
      }
      const obj = {};
      cols.forEach((c, idx) => {
        const raw = parts[idx].trim();
        obj[c] = NUMERIC.has(c) ? Number(raw) : raw;
      });
      return obj;
    });
  }
  return out;
}

module.exports = { parse, COLUMNS };

if (require.main === module) {
  const data = parse();
  for (const k of Object.keys(data)) console.log(`${k}: ${data[k].length} rows`);
}
