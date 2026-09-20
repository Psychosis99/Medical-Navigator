/**
 * End-to-end UI smoke test.
 *
 * Drives the exact assets that ship inside the APK in headless Chromium over
 * file:// (the same scheme and CSP the WebView uses), walking the full patient
 * journey from the blueprint: onboarding -> triage -> search -> doctor ->
 * booking -> teleconsult chat -> cost estimate -> insurance check -> rating.
 *
 * Any console error, page error or failed assertion fails the run. Screenshots
 * land in build/screens/ for a visual check.
 *
 *   node tools/test/ui-smoke.js [--headed]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { parse } = require('./seed-parser');

const ROOT = path.join(__dirname, '../..');
const WWW = path.join(ROOT, 'app/src/main/assets/www');
const SHOTS = path.join(ROOT, 'build/screens');

const failures = [];
const passes = [];

function check(name, condition, detail) {
  if (condition) {
    passes.push(name);
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ' :: ' + detail : ''}`);
    console.log(`  ✗ ${name}${detail ? ' :: ' + detail : ''}`);
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const seed = parse();
  const mock = fs.readFileSync(path.join(__dirname, 'mock-bridge.js'), 'utf8');

  const browser = await chromium.launch({
    headless: !process.argv.includes('--headed'),
    args: ['--allow-file-access-from-files', '--no-sandbox']
  });
  const page = await browser.newPage({
    viewport: { width: 412, height: 892 },          // a typical budget Android screen
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  // Inject the bridge double before any of the app's own scripts run.
  await page.addInitScript(`window.__MEDNAV_SEED = ${JSON.stringify(seed)};`);
  await page.addInitScript(mock);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  };
  const tap = async (selector, options) => {
    await page.click(selector, Object.assign({ timeout: 4000 }, options || {}));
    await page.waitForTimeout(120);
  };
  /** Clicks a real <button> by its label - headings can share the same words. */
  const tapButton = async (label) => {
    await page.getByRole('button', { name: label }).first().click({ timeout: 4000 });
    await page.waitForTimeout(150);
  };
  /** Same, but scoped to the open bottom sheet, whose labels repeat the screen's. */
  const tapSheetButton = async (label) => {
    await page.locator('.sheet').getByRole('button', { name: label })
      .first().click({ timeout: 4000 });
    await page.waitForTimeout(200);
  };
  const body = () => page.textContent('body');

  console.log('\nLoading the packaged UI over file:// ...');
  await page.goto('file://' + path.join(WWW, 'index.html'));
  await page.waitForTimeout(900);

  // ---- CSP sanity: the WebView loads these same files under the same policy ----
  check('scripts executed under the page CSP',
    await page.evaluate(() => typeof window.UI === 'object' && typeof window.Router === 'object'));
  const inlineStyleApplied = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.setAttribute('style', 'width:37px');
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  check('inline style attributes are not blocked by CSP', inlineStyleApplied === 37,
    'probe width was ' + inlineStyleApplied);
  check('stylesheet applied',
    await page.evaluate(() => getComputedStyle(document.querySelector('.appbar'))
      .backgroundColor === 'rgb(15, 118, 110)'));

  // ---- onboarding ----
  console.log('\nOnboarding');
  check('language step shown', (await body()).includes('Choose your language'));
  await shot('01-onboarding-language');
  await tapButton('हिन्दी');
  check('Hindi labels applied', (await body()).includes('शुरू करें'));
  await shot('02-onboarding-hindi');
  await tapButton('English');
  await tapButton('Get started');
  check('OTP step shown', (await body()).includes('Verify your mobile number'));

  await page.fill('input[type=tel]', '9876543210');
  await tapButton('Send OTP');
  const shown = (await body()).match(/OTP:\s*(\d{4})/);
  check('demo OTP is generated and shown', !!shown, 'no OTP found on screen');
  await shot('03-onboarding-otp');
  await page.fill('input[maxlength="4"]', shown ? shown[1] : '0000');
  await tapButton('Verify');
  check('profile step shown', (await body()).includes('Your details'));

  await page.fill('.card input.input', 'Sunita Devi');
  const inputs = page.locator('.card input.input');
  await inputs.nth(1).fill('45');
  await page.selectOption('select.input >> nth=1', { label: 'Siliguri' });
  await tapButton('High blood sugar / diabetes');
  await page.selectOption('select.input >> nth=2', { label: 'Sanjeevani Health Insurance' });
  await page.locator('input.input').last().fill('');
  const planBox = page.locator('label.field', { hasText: 'Plan' }).locator('input');
  await planBox.fill('Silver');
  await shot('04-onboarding-profile');
  await tapButton('Save');
  await page.waitForTimeout(300);

  // ---- welcome guide (shown once, straight after sign-up) ----
  console.log('\nWelcome guide');
  let text = await body();
  check('welcome guide appears after sign-up', text.includes('A guide, not a hospital'));
  check('guide says it does not diagnose', text.includes('does not diagnose'));
  await shot('05-guide-1');
  await tapButton('Next');
  text = await body();
  check('guide page 2 leads with the consultant',
    text.includes('Start with our consultant'));
  check('guide states the first consult is free', text.includes('First consult free'));
  await shot('06-guide-consultant');
  for (var g = 0; g < 4; g++) await tapButton('Next');
  text = await body();
  check('guide ends on the data page', text.includes('Your data stays here'));
  check('guide has a finishing action', text.includes('Start using the app'));
  await tapButton('Start using the app');
  await page.waitForTimeout(300);
  check('guide hands over to the care team',
    (await body()).includes('Dr. Sashanka Dey'));
  check('guide is not shown again',
    (await page.evaluate(() => Store.hasSeenGuide())) === true);

  // ---- the care team: the app's primary feature ----
  console.log('\nCare team');
  text = await body();
  check('primary consultant named', text.includes('Lead Consultant'));
  check('availability shown', text.includes('Available now') || text.includes('Away right now'));
  check('consult topics offered', text.includes('Which doctor should I see?'));
  check('no empty team section while there is only one consultant',
    !text.includes('Your care team'));
  check('every topic routes to the lead consultant',
    (await page.evaluate(() => Native.call('consult_team', {})
      .topics.every(function (t) { return t.role === 'primary'; }))) === true);
  await shot('07-consult-hub');

  await tapButton('Which doctor should I see?');
  await page.waitForTimeout(200);
  await page.locator('.sheet textarea.input')
    .fill('sugar is high and I do not know which doctor to see');
  await shot('08-consult-request');
  await tapSheetButton('Start a chat');
  await page.waitForTimeout(350);
  text = await body();
  check('consult thread opens with the consultant greeting',
    text.includes('I am Dr. Sashanka Dey'));
  check('the patient note is carried into the thread',
    text.includes('which doctor to see'));
  check('consultant answers the routing question',
    text.includes('start with a physician'));
  await page.fill('.composer input.input', 'is this test needed, they advised 6 tests');
  await tapButton('Send');
  await page.waitForTimeout(250);
  check('follow-up gets a care-team reply',
    (await body()).includes('which ones change the treatment'));
  await page.fill('.composer input.input', 'can you book an appointment for me');
  await tapButton('Send');
  await page.waitForTimeout(250);
  check('the consultant also answers logistics questions',
    (await body()).includes('I can arrange it'));
  await page.fill('.composer input.input', 'my cashless claim was rejected');
  await tapButton('Send');
  await page.waitForTimeout(250);
  check('the consultant also answers claim questions',
    (await body()).includes('the reason letter matters most'));
  await shot('09-consult-chat');

  await page.evaluate(() => Router.tab('consult'));
  await page.waitForTimeout(250);
  check('the open consultation is listed', (await body()).includes('Open conversation'));

  // a callback request goes through the non-chat path
  await tapButton('Request a call back');
  await page.waitForTimeout(200);
  await page.locator('.sheet textarea.input').fill('please call about my mother');
  await tapSheetButton('Send request');
  await page.waitForTimeout(300);
  text = await body();
  check('callback confirmation shown', text.includes('will reach you'));
  check('callback is honest that no call is placed',
    text.includes('no call is actually placed'));
  await shot('10-consult-callback');
  await tapSheetButton('Done');
  await page.waitForTimeout(250);
  check('callback request recorded',
    (await page.evaluate(() => Native.call('consult_requests', {}).requests.length)) === 2);

  await page.evaluate(() => Router.tab('home'));
  await page.waitForTimeout(300);
  text = await body();
  check('home leads with the care team', text.includes('Talk to our consultant'));
  check('landed on home after onboarding', text.includes('Namaskar, Sunita'));
  check('profile persisted to the bridge',
    (await page.evaluate(() => Store.profile().city)) === 'Siliguri');
  await shot('11-home');

  // ---- triage -> search -> doctor (the blueprint's Siliguri diabetes journey) ----
  console.log('\nTriage and search');
  await page.fill('.card input.input', 'sugar high and always thirsty');
  await tapButton('Check');
  await page.waitForTimeout(200);
  text = await body();
  check('triage matched diabetes', text.includes('High blood sugar / diabetes'));
  check('triage routed to Endocrinology', text.includes('Endocrinology'));
  check('triage shows a red-flag warning', text.includes('emergency room'));
  await shot('12-triage');

  await page.getByText('Find a doctor').last().click();
  await page.waitForTimeout(250);
  text = await body();
  check('search shows Siliguri endocrinologists', text.includes('Dr. Ananya Basu'));
  check('search shows the district hospital low-cost option', text.includes('Dr. Meenakshi Rai'));
  check('fee bands rendered', /₹\d/.test(text));
  check('cashless badge shown for the insurer', text.includes('Cashless possible'));
  await shot('13-search-results');

  // filters
  await tapButton('Filters');
  await page.waitForTimeout(150);
  await page.selectOption('.sheet select.input >> nth=2', { label: 'Under ₹700' });
  await shot('14-filters');
  await tapButton('Apply');
  await page.waitForTimeout(250);
  text = await body();
  check('fee filter applied and summarised', text.includes('≤ ₹700'));
  check('expensive doctor filtered out', !text.includes('Dr. Piyali Ghosh'));

  // Open a named doctor rather than "the first card": best-value ranking
  // legitimately puts the ₹10 district-hospital OPD first for this filter.
  await page.locator('.card', { hasText: 'Dr. Ananya Basu' })
    .getByRole('button', { name: 'Details' }).first().click({ timeout: 4000 });
  await page.waitForTimeout(250);
  text = await body();
  check('doctor detail shows qualification', text.includes('DM (Endocrinology)'));
  check('doctor detail shows an estimated total', text.includes('Estimated total'));
  check('doctor detail lists commonly advised tests', text.includes('HbA1c'));
  check('doctor detail shows the insurance note',
    text.includes('Cashless possible') || text.includes('reimbursement'));
  await shot('15-doctor-detail');

  // ---- booking + teleconsult chat ----
  console.log('\nBooking and teleconsult');
  await page.getByRole('button', { name: /Book teleconsult/ }).first().click();
  await page.waitForTimeout(250);
  check('booking screen shows the free-minutes rule',
    (await body()).includes('First 10 minutes free'));
  await page.locator('textarea.input').fill('Sugar high for 2 weeks, taking metformin');
  await shot('16-booking');
  await tapButton('Confirm booking');
  await page.waitForTimeout(350);
  text = await body();
  check('chat opened after booking',
    (await page.locator('.composer input.input').getAttribute('placeholder'))
      === 'Type your message');
  check("doctor's opening message present", text.includes('Namaskar, I am Dr.'));

  await page.fill('.composer input.input', 'my hba1c is 8.4, what tests do I need?');
  await tapButton('Send');
  await page.waitForTimeout(250);
  text = await body();
  check('patient message stored', text.includes('my hba1c is 8.4'));
  check('specialty-specific canned reply returned',
    text.includes('HbA1c') || text.includes('urine microalbumin'));
  await shot('17-doctor-chat');

  // ---- cost estimate ----
  console.log('\nCost estimate');
  await page.evaluate(() => Router.tab('cost'));
  await page.waitForTimeout(300);
  text = await body();
  check('cost screen shows a total band', text.includes('Total if done nearby'));
  check('cost screen compares partner labs', text.includes('Cheapest partner lab'));
  check('cost table lists a lab name', text.includes('Himalayan Mission Lab'));
  check('savings line shown', text.includes('You could save'));
  await shot('18-cost-estimate');

  await tapButton('Select tests');
  await page.waitForTimeout(150);
  check('test picker lists the seeded tests',
    (await body()).includes('Kidney function test'));
  await tapButton('Apply');
  await page.waitForTimeout(200);

  // ---- insurance ----
  console.log('\nInsurance');
  await page.evaluate(() => Router.tab('insurance'));
  await page.waitForTimeout(300);
  text = await body();
  check('insurance hub names the chosen cover', text.includes('Sanjeevani Health Insurance'));
  check('pre-admission steps listed', text.includes('pre-authorisation'));
  await shot('19-insurance-hub');

  await tapButton('Check insurance coverage');
  await page.waitForTimeout(250);
  await page.selectOption('select.input >> nth=1',
    { label: 'Teesta Valley Multispeciality · Siliguri' });
  await page.waitForTimeout(300);
  text = await body();
  check('network hospital detected as cashless', text.includes('Cashless possible'));
  check('what-to-carry checklist rendered', text.includes('Insurance card or policy number'));
  check('policy clauses rendered', text.includes('In-patient hospitalisation'));
  await shot('20-insurance-check');

  await page.selectOption('select.input >> nth=1',
    { label: 'Himalayan Mission Trust Hospital · Siliguri' });
  await page.waitForTimeout(300);
  text = await body();
  check('non-network hospital flagged', text.includes('Not in your network'));
  check('cashless alternatives offered', text.includes('Cashless alternatives'));
  await shot('21-insurance-not-network');

  await page.evaluate(() => Router.go('policy', {}));
  await page.waitForTimeout(250);
  text = await body();
  check('policy reader groups clauses', text.includes('Not covered') && text.includes('Covered'));
  check('policy reader is honest about parsing',
    text.includes('pre-parsed sample clauses'));
  await shot('22-policy');

  // ---- bookings, rating, records, metrics ----
  console.log('\nVisits, rating, records and metrics');
  await page.evaluate(() => Router.go('bookings', {}));
  await page.waitForTimeout(250);
  check('booking listed under upcoming', (await body()).includes('Upcoming'));
  await tapButton('Mark as completed');
  await page.waitForTimeout(300);
  check('rating screen opened', (await body()).includes('Rate this visit'));
  await page.locator('.star.tappable').nth(3).click();      // 4 stars for the doctor
  await page.locator('.star.tappable').nth(9).click();      // 5 stars for the hospital
  await page.waitForTimeout(150);
  await shot('23-rating');
  await tapButton('Submit rating');
  await page.waitForTimeout(300);
  check('rating recorded on the booking',
    (await page.evaluate(() => Native.call('bookings', {}).bookings[0].rated)) === 1);

  await page.evaluate(() => Router.go('records', {}));
  await page.waitForTimeout(200);
  await tapButton('Add a note');
  await page.waitForTimeout(150);
  await page.locator('.sheet input.input').fill('Fasting sugar 142');
  await page.locator('.sheet textarea.input').fill('Morning reading, before breakfast');
  await tapButton('Save');
  await page.waitForTimeout(250);
  check('record saved and listed', (await body()).includes('Fasting sugar 142'));
  await shot('24-records');

  await page.evaluate(() => Router.go('metrics', {}));
  await page.waitForTimeout(250);
  text = await body();
  check('metrics funnel rendered', text.includes('Search → booking'));
  check('metrics counted the search', /Searches/.test(text));
  check('metrics count consult requests', text.includes('Consult requests'));
  await shot('25-metrics');

  await page.evaluate(() => Router.go('about', {}));
  await page.waitForTimeout(200);
  text = await body();
  check('about screen states the limitations', text.includes('fictional sample data'));
  check('about screen shows the version', text.includes('1.0.0-test'));
  await shot('26-about');

  // ---- emergency + device hand-offs ----
  console.log('\nEmergency and device hand-offs');
  await page.evaluate(() => Router.go('emergency', {}));
  await page.waitForTimeout(250);
  text = await body();
  check('ambulance helpline listed', text.includes('108'));
  check('emergency hospitals listed for the city',
    text.includes('Teesta Valley') || text.includes('Sadar Jilla'));
  await page.getByRole('button', { name: /Call now/ }).first().click();
  check('dial handed to the native layer',
    (await page.evaluate(() => window.__MEDNAV_DIAL)) === '108');
  await shot('27-emergency');

  await page.evaluate(() => Router.tab('me'));
  await page.waitForTimeout(250);
  text = await body();
  check('Me tab links to past consultations', text.includes('My consultations'));
  check('Me tab can re-open the guide', text.includes('How this app works'));
  await page.getByRole('button', { name: /Share this app/ }).first().click();
  check('share handed to the native layer',
    String(await page.evaluate(() => window.__MEDNAV_SHARE || '')).includes('Medical Navigator'));
  await shot('28-me');

  // ---- back-button contract used by MainActivity ----
  await page.evaluate(() => Router.go('about', {}));
  const handled = await page.evaluate(() => window.MedNavBack());
  check('MedNavBack consumes back when the stack is deep', handled === true);
  const atRoot = await page.evaluate(() => {
    Router.tab('home');
    return window.MedNavBack();
  });
  check('MedNavBack releases back at the root', atRoot === false);

  // ---- language switch across a populated app ----
  await page.evaluate(() => { I18n.set('bn'); Router.render(); });
  await page.waitForTimeout(250);
  check('Bengali chrome applied', (await body()).includes('চিকিৎসা খুঁজুন'));
  await shot('29-bengali-home');
  await page.evaluate(() => { I18n.set('en'); Router.render(); });

  check('no console or page errors', consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | '));

  const ops = await page.evaluate(() => window.__MEDNAV_CALLS);
  const unique = Array.from(new Set(ops));
  console.log(`\nBridge ops exercised (${unique.length}): ${unique.join(', ')}`);

  await browser.close();

  console.log(`\n${passes.length} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log(`Screenshots in ${path.relative(ROOT, SHOTS)}/`);
}

main().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
