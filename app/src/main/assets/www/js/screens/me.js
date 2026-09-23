/* Me tab: bookings, records, profile, pilot metrics, about. */
(function () {
  'use strict';
  var el = UI.el;

  Screens.me = {
    title: function () { return I18n.t('nav_me'); },
    tab: 'me',
    render: function (params, view) {
      var p = Store.profile();
      view.appendChild(UI.card([
        UI.row([
          el('div.strong', { style: 'font-size:16px', text: p.name || 'Your profile' }),
          el('div.small.muted', { text: [p.age ? p.age + ' yrs' : '', p.sex || '', p.city || '']
            .filter(function (x) { return !!x; }).join(' · ') }),
          el('div.small.muted', { text: p.phone ? '+91 ' + p.phone : 'No number saved' }),
          Store.insurerId()
            ? el('div.tiny.muted', { text: Store.insurerName() +
                (p.plan ? ' · ' + p.plan : '') })
            : el('div.tiny.muted', { text: 'No insurance added' })
        ], [
          UI.button('Edit', {
            variant: 'ghost',
            onclick: function () { Router.go('profile', {}); }
          })
        ])
      ]));

      var items = [
        { icon: '⚕', label: I18n.t('my_consults'), screen: 'consult_history' },
        { icon: '☑', label: I18n.t('my_visits'), screen: 'bookings' },
        { icon: '☷', label: I18n.t('records'), screen: 'records' },
        { icon: '✉', label: 'Claim tracker', screen: 'claims' },
        { icon: '⛨', label: I18n.t('insurance_help'), tab: 'insurance' },
        { icon: '◷', label: I18n.t('pilot_metrics'), screen: 'metrics' },
        { icon: '◷', label: I18n.t('guide_title'), screen: 'guide' },
        { icon: 'ℹ', label: I18n.t('about'), screen: 'about' }
      ];
      var list = el('div');
      for (var i = 0; i < items.length; i++) {
        (function (item) {
          list.appendChild(UI.card([
            UI.row([el('div.strong', { text: item.icon + '   ' + item.label })],
              el('span.muted', { text: '›' }))
          ], {
            tappable: true,
            onclick: function () {
              if (item.tab) Router.tab(item.tab);
              else Router.go(item.screen, {});
            }
          }));
        }(items[i]));
      }
      view.appendChild(UI.section(null, list));

      view.appendChild(UI.section(null, el('div', null, [
        UI.button(I18n.t('share_app'), {
          block: true, variant: 'ghost',
          onclick: function () {
            Native.share('Medical Navigator - find the right doctor, know the cost '
              + 'before you go, and use your health insurance properly. '
              + 'Pilot build for Tier-2/3 India.');
            Native.track('app_shared', '');
          }
        }),
        el('div', { style: 'height:8px' }),
        UI.button(I18n.t('choose_language') + ' · ' + I18n.name(I18n.get()), {
          block: true, variant: 'outline',
          onclick: function () { Router.showLanguageSheet(); }
        }),
        el('div', { style: 'height:8px' }),
        UI.button(I18n.t('reset_data'), {
          block: true, variant: 'outline',
          onclick: function () {
            UI.confirmSheet(I18n.t('reset_data'),
              'This erases your profile, bookings, chats, ratings and records from '
              + 'this phone. It cannot be undone.',
              function () {
                Native.call('reset_data', {});
                Store.bootstrap();
                UI.snack('All local data erased');
                Router.go('onboarding', {}, { reset: true });
              }, I18n.t('reset_data'));
          }
        })
      ])));

      view.appendChild(Chrome.adviceBanner());
    }
  };

  // ------------------------------------------------------------------
  // Bookings
  // ------------------------------------------------------------------
  Screens.bookings = {
    title: function () { return I18n.t('my_visits'); },
    tab: null,
    render: function (params, view) {
      var res = Native.call('bookings', {});
      if (!res.ok || !res.bookings.length) {
        view.appendChild(UI.empty(I18n.t('no_bookings'), '☑'));
        view.appendChild(UI.button(I18n.t('find_doctor'), {
          block: true, onclick: function () { Router.tab('find'); }
        }));
        return;
      }
      var upcoming = [], past = [];
      for (var i = 0; i < res.bookings.length; i++) {
        var b = res.bookings[i];
        (b.status === 'confirmed' ? upcoming : past).push(b);
      }
      if (upcoming.length) {
        var u = el('div');
        for (var j = 0; j < upcoming.length; j++) u.appendChild(Cards.booking(upcoming[j]));
        view.appendChild(UI.section(I18n.t('upcoming'), u));
      }
      if (past.length) {
        var pa = el('div');
        for (var k = 0; k < past.length; k++) pa.appendChild(Cards.booking(past[k]));
        view.appendChild(UI.section(I18n.t('past'), pa));
      }
    }
  };

  // ------------------------------------------------------------------
  // Records
  // ------------------------------------------------------------------
  Screens.records = {
    title: function () { return I18n.t('records'); },
    tab: null,
    render: function (params, view) {
      view.appendChild(el('div.banner.info', null, [
        el('span.banner-icon', { text: 'ℹ' }),
        el('span', { text: 'Notes stay on this phone. Linking records to ABHA under '
          + 'ABDM is a Phase-II item.' })
      ]));
      view.appendChild(UI.button(I18n.t('add_note'), {
        block: true, variant: 'ghost',
        onclick: function () { openNoteSheet({}); }
      }));

      var res = Native.call('records', {});
      if (!res.ok || !res.records.length) {
        view.appendChild(UI.empty('No records saved yet. Add your sugar readings, '
          + 'prescriptions or report values.', '☷'));
        return;
      }
      for (var i = 0; i < res.records.length; i++) {
        (function (rec) {
          view.appendChild(UI.card([
            UI.row([
              el('div.strong', { text: rec.title || rec.kind }),
              el('div.tiny.muted', { text: rec.kind + ' · ' + UI.timeAgo(rec.ts) })
            ], [
              UI.badge(rec.kind, 'flat')
            ]),
            rec.body ? el('p.small', { style: 'margin:8px 0 0', text: rec.body }) : null,
            el('div.btn-grid', { style: 'margin-top:10px' }, [
              UI.button('Edit', {
                variant: 'outline',
                onclick: function () { openNoteSheet(rec); }
              }),
              UI.button('Delete', {
                variant: 'outline',
                onclick: function () {
                  UI.confirmSheet('Delete', 'Delete this record?', function () {
                    Native.call('delete_record', { id: rec.id });
                    Router.render();
                  }, 'Delete');
                }
              })
            ])
          ]));
        }(res.records[i]));
      }
    }
  };

  function openNoteSheet(rec) {
    var kindSelect = UI.select([
      { value: 'reading', label: 'Reading (sugar, BP, weight)' },
      { value: 'prescription', label: 'Prescription' },
      { value: 'report', label: 'Report value' },
      { value: 'note', label: 'Note' }
    ], rec.kind || 'reading');
    var titleInput = UI.input({ placeholder: 'e.g. Fasting sugar 142', value: rec.title || '' });
    var bodyInput = UI.el('textarea.input', {
      placeholder: 'Details, medicine names, doses, dates'
    });
    if (rec.body) bodyInput.value = rec.body;

    var close = UI.sheet(rec.id ? 'Edit record' : I18n.t('add_note'), [
      UI.field('Type', kindSelect),
      UI.field(I18n.t('note_title'), titleInput),
      UI.field(I18n.t('note_body'), bodyInput)
    ], [
      UI.button(I18n.t('cancel'), { variant: 'outline', onclick: function () { close(); } }),
      UI.button(I18n.t('save'), {
        onclick: function () {
          if (!String(titleInput.value).trim()) {
            UI.snack('Please add a title');
            return;
          }
          Native.call('save_record', {
            id: rec.id || '', kind: kindSelect.value,
            title: String(titleInput.value).trim(),
            body: String(bodyInput.value).trim()
          });
          close();
          Router.render();
        }
      })
    ]);
  }

  // ------------------------------------------------------------------
  // Profile editor
  // ------------------------------------------------------------------
  Screens.profile = {
    title: function () { return I18n.t('profile'); },
    tab: null,
    render: function (params, view) {
      var p = Store.profile();
      var nameInput = UI.input({ value: p.name || '' });
      var phoneInput = UI.input({ type: 'tel', inputmode: 'numeric', maxlength: 10,
        value: p.phone || '' });
      var ageInput = UI.input({ type: 'tel', inputmode: 'numeric', maxlength: 3,
        value: p.age || '' });
      var sexSelect = UI.select([
        { value: 'female', label: I18n.t('female') },
        { value: 'male', label: I18n.t('male') },
        { value: 'other', label: I18n.t('other') }
      ], p.sex || 'female');
      var citySelect = UI.select(Store.state.cities, p.city || '');
      var abhaInput = UI.input({ value: p.abha || '' });
      var planInput = UI.input({ value: p.plan || '' });

      var insurerOptions = [{ value: '', label: '-- none --' }];
      for (var i = 0; i < Store.state.insurers.length; i++) {
        insurerOptions.push({
          value: Store.state.insurers[i].id, label: Store.state.insurers[i].name
        });
      }
      var insurerSelect = UI.select(insurerOptions, p.insurer_id || '');

      var chosen = (p.conditions ? String(p.conditions).split(',') : []);
      var condWrap = el('div.wrap');
      for (var c = 0; c < Store.state.conditions.length; c++) {
        (function (cond) {
          var chip = UI.chip(cond.label, {
            active: chosen.indexOf(cond.id) >= 0,
            onclick: function () {
              var idx = chosen.indexOf(cond.id);
              if (idx >= 0) chosen.splice(idx, 1); else chosen.push(cond.id);
              chip.className = 'chip' + (chosen.indexOf(cond.id) >= 0 ? ' active' : '');
            }
          });
          condWrap.appendChild(chip);
        }(Store.state.conditions[c]));
      }

      view.appendChild(UI.card([
        UI.field(I18n.t('full_name'), nameInput),
        UI.field(I18n.t('mobile_number'), phoneInput),
        el('div.field-grid', null, [
          UI.field(I18n.t('age'), ageInput),
          UI.field(I18n.t('sex'), sexSelect)
        ]),
        UI.field(I18n.t('city'), citySelect)
      ]));
      view.appendChild(UI.section(I18n.t('conditions_you_have'), UI.card([condWrap])));
      view.appendChild(UI.section(I18n.t('insurance_optional'), UI.card([
        UI.field(I18n.t('insurer'), insurerSelect),
        UI.field(I18n.t('plan'), planInput),
        UI.field(I18n.t('abha_optional'), abhaInput)
      ])));

      view.appendChild(UI.button(I18n.t('save'), {
        block: true,
        onclick: function () {
          Store.saveProfile({
            name: String(nameInput.value).trim(),
            phone: String(phoneInput.value).replace(/[^0-9]/g, ''),
            age: String(ageInput.value).trim(),
            sex: sexSelect.value,
            city: citySelect.value,
            conditions: chosen.join(','),
            insurer_id: insurerSelect.value,
            plan: planInput.value,
            abha: abhaInput.value,
            onboarded: '1'
          });
          UI.snack('Profile saved');
          Router.back();
        }
      }));
    }
  };

  // ------------------------------------------------------------------
  // Pilot metrics (the funnel the blueprint asks the pilot to measure)
  // ------------------------------------------------------------------
  Screens.metrics = {
    title: function () { return I18n.t('pilot_metrics'); },
    tab: null,
    render: function (params, view) {
      var res = Native.call('metrics', {});
      if (!res.ok) {
        view.appendChild(el('div.banner.danger', null, [res.error || 'No metrics']));
        return;
      }
      view.appendChild(el('div.banner.info', null, [
        el('span.banner-icon', { text: 'ℹ' }),
        el('span', { text: 'Counted on this device only, so a pilot team can read the '
          + 'funnel without any server or tracking SDK.' })
      ]));

      var f = res.funnel;
      var grid = el('div.metric-grid');
      grid.appendChild(metric(f.searches, 'Searches'));
      grid.appendChild(metric(f.doctorViews, 'Doctor views'));
      grid.appendChild(metric(f.bookings, 'Bookings'));
      grid.appendChild(metric(f.teleMessages, 'Chat messages'));
      grid.appendChild(metric(f.completed, 'Visits completed'));
      grid.appendChild(metric(f.ratings, 'Ratings given'));
      grid.appendChild(metric(f.consultRequests, 'Consult requests'));
      view.appendChild(UI.section('Funnel', grid));

      var steps = [
        { label: 'Search', n: f.searches },
        { label: 'Doctor view', n: f.doctorViews },
        { label: 'Booking', n: f.bookings },
        { label: 'Completed', n: f.completed },
        { label: 'Rated', n: f.ratings }
      ];
      var max = 1;
      for (var i = 0; i < steps.length; i++) max = Math.max(max, Number(steps[i].n));
      var bars = el('div');
      for (var s = 0; s < steps.length; s++) {
        var pct = Math.round((Number(steps[s].n) / max) * 100);
        bars.appendChild(el('div.bar-row', null, [
          el('span.bar-label', { text: steps[s].label }),
          el('span.bar-track', null, [
            el('span.bar-fill', { style: 'width:' + pct + '%' })
          ]),
          el('span.bar-value', { text: String(steps[s].n) })
        ]));
      }
      view.appendChild(UI.section('Conversion', UI.card([
        bars,
        el('div.divider'),
        el('div.kv', null, [
          el('span.k', { text: 'Search → booking' }),
          el('span.v', { text: rate(f.bookings, f.searches) })
        ]),
        el('div.kv', null, [
          el('span.k', { text: 'Booking → completed' }),
          el('span.v', { text: rate(f.completed, f.bookings) })
        ]),
        el('div.kv', null, [
          el('span.k', { text: 'Completed → rated' }),
          el('span.v', { text: rate(f.ratings, f.completed) })
        ]),
        el('div.kv', null, [
          el('span.k', { text: 'Insurance checks' }),
          el('span.v', { text: String(f.insuranceChecks) })
        ])
      ])));

      if (res.byDay && res.byDay.length) {
        var dayWrap = el('div');
        var dayMax = 1;
        for (var d = 0; d < res.byDay.length; d++) {
          dayMax = Math.max(dayMax, Number(res.byDay[d].n));
        }
        for (var q = 0; q < res.byDay.length; q++) {
          var pctDay = Math.round((Number(res.byDay[q].n) / dayMax) * 100);
          dayWrap.appendChild(el('div.bar-row', null, [
            el('span.bar-label', { text: res.byDay[q].day }),
            el('span.bar-track', null, [
              el('span.bar-fill', { style: 'width:' + pctDay + '%' })
            ]),
            el('span.bar-value', { text: String(res.byDay[q].n) })
          ]));
        }
        view.appendChild(UI.section('Activity by day', UI.card([dayWrap])));
      }

      if (res.recent && res.recent.length) {
        var log = el('div');
        for (var r = 0; r < res.recent.length; r++) {
          log.appendChild(el('div.kv', null, [
            el('span.k', { text: res.recent[r].name +
              (res.recent[r].props ? ' · ' + res.recent[r].props : '') }),
            el('span.v', { text: UI.timeAgo(res.recent[r].ts) })
          ]));
        }
        view.appendChild(UI.section('Recent events', UI.card([log])));
      }

      view.appendChild(UI.button('Share this funnel', {
        block: true, variant: 'ghost',
        onclick: function () {
          Native.share('Medical Navigator pilot funnel\n'
            + 'Searches: ' + f.searches + '\nDoctor views: ' + f.doctorViews
            + '\nBookings: ' + f.bookings + '\nCompleted: ' + f.completed
            + '\nRatings: ' + f.ratings + '\nInsurance checks: ' + f.insuranceChecks);
        }
      }));
    }
  };

  function metric(n, label) {
    return el('div.metric', null, [
      el('div.n', { text: String(n) }),
      el('div.l', { text: label })
    ]);
  }

  function rate(a, b) {
    a = Number(a); b = Number(b);
    if (!b) return '--';
    return Math.round((a / b) * 100) + '%';
  }

  // ------------------------------------------------------------------
  // About
  // ------------------------------------------------------------------
  /** Kept in one place so the address appears identically wherever it is shown. */
  var BRAND_EMAIL = 'do3rs.and.th1nkers@gmail.com';

  Screens.about = {
    title: function () { return I18n.t('about'); },
    tab: null,
    render: function (params, view) {
      var info = Native.info();
      view.appendChild(UI.card([
        el('div.brand-footer', null, [
          el('img.brand-mark', { src: 'img/logo.jpg', alt: '',
            style: 'width:84px;height:84px' }),
          el('div.strong', { style: 'font-size:17px', text: I18n.t('app_name') }),
          el('div.line', { text: I18n.t('company_line') })
        ]),
        el('p.small.muted.center', { text: I18n.t('tagline') }),
        el('div.divider'),
        el('div.kv', null, [el('span.k', { text: 'Version' }),
          el('span.v', { text: info.versionName + ' (' + info.versionCode + ')' })]),
        el('div.kv', null, [el('span.k', { text: 'Build' }),
          el('span.v', { text: info.buildStamp })]),
        el('div.kv', null, [el('span.k', { text: 'Package' }),
          el('span.v', { text: info.packageName })]),
        el('div.kv', null, [el('span.k', { text: 'Android' }),
          el('span.v', { text: info.androidRelease + ' (API ' + info.sdkInt + ')' })]),
        el('div.kv', null, [el('span.k', { text: 'Device' }),
          el('span.v', { text: info.device })]),
        el('div.kv', null, [el('span.k', { text: 'Data' }),
          el('span.v', { text: 'Local SQLite, offline' })]),
        el('div.kv', null, [el('span.k', { text: I18n.t('email_label') }),
          el('span.v', { text: BRAND_EMAIL })])
      ]));

      view.appendChild(UI.button(I18n.t('email_us'), {
        block: true, variant: 'ghost',
        onclick: function () {
          Native.email(BRAND_EMAIL, 'Medical Navigator - feedback', '');
        }
      }));

      view.appendChild(UI.section('What this build is', UI.card([
        el('p.small', { text: 'A pilot MVP for a patient-side medical navigator aimed at '
          + 'Tier-2 and Tier-3 India: find the right doctor, see the likely cost before '
          + 'going, and use health insurance without being surprised at the billing desk.' }),
        el('p.small', { text: 'Everything runs on the phone. There is no account, no '
          + 'server, no analytics SDK and no data leaves the device.' })
      ])));

      view.appendChild(UI.section('Honest limitations', UI.card([
        el('ul', { style: 'padding-left:18px;margin:0' }, [
          el('li.small', { text: 'Doctors, hospitals, labs, fees and policy clauses are '
            + 'fictional sample data for the pilot, not real listings.' }),
          el('li.small', { text: 'The consultant is identified by role, not by name. '
            + 'Replies come from a fixed rule table, not a live clinician.' }),
          el('li.small', { text: 'The consultant is reachable by in-app message or '
            + 'email only. There is no phone or video channel in this build.' }),
          el('li.small', { text: 'OTP is generated on the device; no SMS gateway is wired up.' }),
          el('li.small', { text: 'No payment gateway, so no money moves and no real '
            + 'appointment is created.' }),
          el('li.small', { text: 'Policy document parsing, ABDM/ABHA linking and live '
            + 'video consults are Phase-II items.' })
        ])
      ])));

      view.appendChild(Chrome.adviceBanner());
      view.appendChild(el('p.tiny.muted.center', {
        text: 'For a medical emergency, call an ambulance on 108 or 112.'
      }));
    }
  };
}());
