/* Triage, doctor search, doctor detail, booking, chat and rating. */
(function () {
  'use strict';
  var el = UI.el;

  /** Filters persist while the user stays inside the Find tab. */
  var filters = {
    specialty: '', city: '', q: '', maxFee: 0, insurerOnly: false,
    teleOnly: false, govtSchemeOnly: false, minRating: 0, maxDistance: 0,
    sort: 'value'
  };

  // ------------------------------------------------------------------
  // Find tab: entry point with specialty grid + recent searches
  // ------------------------------------------------------------------
  Screens.find = {
    title: function () { return I18n.t('find_doctor'); },
    tab: 'find',
    render: function (params, view) {
      var qInput = UI.input({
        placeholder: 'Doctor, specialty, hospital or language',
        value: filters.q
      });
      qInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
      });
      function submit() {
        filters.q = String(qInput.value).trim();
        Router.go('search', { specialty: '', city: Store.city(), q: filters.q });
      }
      view.appendChild(UI.card([
        qInput,
        UI.button(I18n.t('search'), { block: true, onclick: submit })
      ]));

      var grid = el('div.action-grid');
      for (var i = 0; i < Store.state.specialties.length; i++) {
        (function (sp) {
          grid.appendChild(el('button.action', {
            onclick: function () {
              Router.go('search', { specialty: sp, city: Store.city() });
            }
          }, [
            el('span.action-label', { text: sp }),
            el('span.action-sub', { text: specialtyHint(sp) })
          ]));
        }(Store.state.specialties[i]));
      }
      view.appendChild(UI.section(I18n.t('specialty'), grid));

      view.appendChild(UI.section('Or start from the problem', UI.card([
        el('p.small.muted', { text: I18n.t('symptom_hint') }),
        UI.button(I18n.t('what_troubles_you'), {
          block: true, variant: 'ghost',
          onclick: function () { Router.tab('home'); }
        })
      ])));

      view.appendChild(UI.section(I18n.t('hospital'), UI.card([
        el('p.small.muted', { text: 'Browse hospitals in your city, with cashless status.' }),
        UI.button('See hospitals', {
          block: true, variant: 'ghost',
          onclick: function () { Router.go('hospitals', {}); }
        })
      ])));
    }
  };

  var HINTS = {
    'Endocrinology': 'Diabetes, thyroid, hormones',
    'General Medicine': 'Fever, BP, first check',
    'Cardiology': 'Heart, chest pain, BP',
    'Nephrology': 'Kidney, swelling, dialysis',
    'Orthopaedics': 'Bones, joints, injury',
    'Obstetrics & Gynaecology': 'Pregnancy, periods, PCOS',
    'Paediatrics': 'Children and newborns',
    'Dermatology': 'Skin, hair, nails',
    'Ophthalmology': 'Eyes and vision',
    'Psychiatry': 'Stress, sleep, mood',
    'Pulmonology': 'Asthma, COPD, cough',
    'ENT': 'Ear, nose, throat',
    'Gastroenterology': 'Stomach, liver, acidity'
  };
  function specialtyHint(sp) { return HINTS[sp] || 'Specialist care'; }

  // ------------------------------------------------------------------
  // Triage -> specialty
  // ------------------------------------------------------------------
  Screens.triage = {
    title: function () { return I18n.t('what_troubles_you'); },
    tab: null,
    render: function (params, view) {
      var res = Native.call('triage', { text: params.text || '' });
      Native.track('triage', params.text || '');

      view.appendChild(el('div.banner.info', null, [
        el('span.banner-icon', { text: 'ℹ' }),
        el('span', { text: 'Matched from a fixed rule table a clinician can review - '
          + 'no AI guessing in this build.' })
      ]));
      view.appendChild(el('p.small.muted', { text: 'You typed: "' + (params.text || '') + '"' }));

      if (!res.ok || !res.matches.length) {
        view.appendChild(UI.empty('No match found. Try simpler words like "sugar", '
          + '"chest pain" or "fever", or browse specialties.', '⌕'));
        view.appendChild(UI.button(I18n.t('find_doctor'), {
          block: true, onclick: function () { Router.tab('find'); }
        }));
        return;
      }

      for (var i = 0; i < res.matches.length && i < 5; i++) {
        (function (m) {
          var testNames = [];
          for (var t = 0; t < (m.testDetails || []).length; t++) {
            testNames.push(m.testDetails[t].name);
          }
          var card = UI.card([
            el('div.spread', null, [
              el('div.strong', { text: m.label }),
              UI.badge(m.specialty, '')
            ]),
            m.red_flags && m.red_flags !== '-'
              ? el('div.banner.danger', { style: 'margin:8px 0 6px' }, [
                  el('span.banner-icon', { text: '⚠' }),
                  el('span', { text: m.red_flags })
                ])
              : null,
            testNames.length ? el('div.small.muted', {
              text: I18n.t('common_tests') + ': ' + testNames.join(', ')
            }) : null,
            el('div.btn-grid', { style: 'margin-top:10px' }, [
              UI.button(I18n.t('cost_estimate'), {
                variant: 'ghost',
                onclick: function () {
                  Router.go('cost', { tests: (m.tests || '').split(',') });
                }
              }),
              UI.button(I18n.t('find_doctor'), {
                onclick: function () {
                  Router.go('search', { specialty: m.specialty, city: Store.city() });
                }
              })
            ])
          ]);
          view.appendChild(card);
        }(res.matches[i]));
      }
    }
  };

  // ------------------------------------------------------------------
  // Search results
  // ------------------------------------------------------------------
  Screens.search = {
    title: function (p) { return p.specialty || I18n.t('find_doctor'); },
    subtitle: function (p) { return p.city || Store.city() || 'All cities'; },
    tab: null,
    action: function () {
      return el('button.lang-btn', {
        text: I18n.t('filters'),
        onclick: function () { openFilterSheet(); }
      });
    },
    render: function (params, view) {
      if (params.specialty !== undefined) filters.specialty = params.specialty || '';
      if (params.city !== undefined) filters.city = params.city || '';
      if (params.q !== undefined) filters.q = params.q || '';
      renderResults(view);
    }
  };

  function renderResults(view) {
    UI.clear(view);

    var args = {
      specialty: filters.specialty,
      city: filters.city,
      q: filters.q,
      maxFee: filters.maxFee,
      insurerId: filters.insurerOnly ? Store.insurerId() : '',
      teleOnly: filters.teleOnly,
      govtSchemeOnly: filters.govtSchemeOnly,
      minRating: filters.minRating,
      maxDistance: filters.maxDistance,
      sort: filters.sort
    };
    var res = Native.call('search_doctors', args);
    Native.track('search', (filters.specialty || 'any') + '@' + (filters.city || 'any'));

    // Active filter summary, each chip removable in one tap.
    var active = el('div.wrap', { style: 'margin-bottom:10px' });
    if (filters.specialty) {
      active.appendChild(UI.chip(filters.specialty + ' ×', {
        active: true,
        onclick: function () { filters.specialty = ''; renderResults(view); }
      }));
    }
    if (filters.city) {
      active.appendChild(UI.chip(filters.city + ' ×', {
        active: true,
        onclick: function () { filters.city = ''; renderResults(view); }
      }));
    }
    if (filters.q) {
      active.appendChild(UI.chip('"' + filters.q + '" ×', {
        active: true,
        onclick: function () { filters.q = ''; renderResults(view); }
      }));
    }
    if (filters.maxFee) {
      active.appendChild(UI.chip('≤ ' + UI.rupees(filters.maxFee) + ' ×', {
        active: true,
        onclick: function () { filters.maxFee = 0; renderResults(view); }
      }));
    }
    if (filters.insurerOnly) {
      active.appendChild(UI.chip(Store.insurerName() + ' ×', {
        active: true,
        onclick: function () { filters.insurerOnly = false; renderResults(view); }
      }));
    }
    if (filters.teleOnly) {
      active.appendChild(UI.chip(I18n.t('teleconsult') + ' ×', {
        active: true,
        onclick: function () { filters.teleOnly = false; renderResults(view); }
      }));
    }
    if (filters.govtSchemeOnly) {
      active.appendChild(UI.chip(I18n.t('govt_scheme') + ' ×', {
        active: true,
        onclick: function () { filters.govtSchemeOnly = false; renderResults(view); }
      }));
    }
    active.appendChild(UI.chip(I18n.t('filters') + ' ⚙', {
      onclick: function () { openFilterSheet(view); }
    }));
    view.appendChild(active);

    if (!res.ok) {
      view.appendChild(el('div.banner.danger', null, [res.error || 'Search failed']));
      return;
    }

    view.appendChild(UI.row(
      [el('div.small.muted', { text: res.count + ' ' +
        (res.count === 1 ? 'doctor' : 'doctors') + ' · ' + sortLabel(filters.sort) })],
      el('button.block-link', {
        text: I18n.t('sort_by'), onclick: function () { openSortSheet(view); }
      })
    ));

    if (!res.count) {
      view.appendChild(UI.empty(I18n.t('no_results'), '⌕'));
      view.appendChild(UI.button(I18n.t('clear') + ' ' + I18n.t('filters'), {
        block: true, variant: 'ghost',
        onclick: function () {
          filters.maxFee = 0; filters.insurerOnly = false; filters.teleOnly = false;
          filters.govtSchemeOnly = false; filters.minRating = 0; filters.maxDistance = 0;
          renderResults(view);
        }
      }));
      return;
    }

    for (var i = 0; i < res.doctors.length; i++) {
      view.appendChild(Cards.doctor(res.doctors[i]));
    }
    view.appendChild(el('p.tiny.muted.center', { text: I18n.t('demo_banner') }));
  }

  function sortLabel(sort) {
    return {
      value: I18n.t('best_value'), fee: I18n.t('lowest_fee'),
      rating: I18n.t('highest_rated'), distance: I18n.t('nearest'),
      experience: I18n.t('most_experienced')
    }[sort] || sort;
  }

  function openSortSheet(view) {
    var options = ['value', 'fee', 'rating', 'distance', 'experience'];
    var grid = el('div.lang-grid');
    for (var i = 0; i < options.length; i++) {
      (function (opt) {
        grid.appendChild(el('button.lang-opt' + (filters.sort === opt ? ' active' : ''), {
          text: sortLabel(opt),
          onclick: function () {
            filters.sort = opt;
            Router.back();
            renderResults(view || document.getElementById('view'));
          }
        }));
      }(options[i]));
    }
    UI.sheet(I18n.t('sort_by'), [grid]);
  }

  function openFilterSheet(view) {
    var target = view || document.getElementById('view');

    var specialtyOptions = [{ value: '', label: I18n.t('any_specialty') }];
    for (var i = 0; i < Store.state.specialties.length; i++) {
      specialtyOptions.push({
        value: Store.state.specialties[i], label: Store.state.specialties[i]
      });
    }
    var cityOptions = [{ value: '', label: 'All cities' }];
    for (var c = 0; c < Store.state.cities.length; c++) {
      cityOptions.push({ value: Store.state.cities[c], label: Store.state.cities[c] });
    }

    var specialtySelect = UI.select(specialtyOptions, filters.specialty);
    var citySelect = UI.select(cityOptions, filters.city);
    var feeSelect = UI.select([
      { value: 0, label: 'Any fee' },
      { value: 100, label: 'Under ₹100 (govt / trust)' },
      { value: 300, label: 'Under ₹300' },
      { value: 500, label: 'Under ₹500' },
      { value: 700, label: 'Under ₹700' },
      { value: 1000, label: 'Under ₹1000' }
    ], filters.maxFee);
    var ratingSelect = UI.select([
      { value: 0, label: 'Any rating' },
      { value: 3.5, label: '3.5★ and above' },
      { value: 4, label: '4.0★ and above' },
      { value: 4.3, label: '4.3★ and above' }
    ], filters.minRating);
    var distanceSelect = UI.select([
      { value: 0, label: 'Any distance' },
      { value: 3, label: 'Within 3 km' },
      { value: 5, label: 'Within 5 km' },
      { value: 10, label: 'Within 10 km' }
    ], filters.maxDistance);

    var insurerCheck = UI.input({ type: 'checkbox', checked: filters.insurerOnly });
    var teleCheck = UI.input({ type: 'checkbox', checked: filters.teleOnly });
    var schemeCheck = UI.input({ type: 'checkbox', checked: filters.govtSchemeOnly });

    var body = [
      UI.field(I18n.t('specialty'), specialtySelect),
      UI.field(I18n.t('city'), citySelect),
      UI.field(I18n.t('max_opd_fee'), feeSelect),
      UI.field(I18n.t('highest_rated'), ratingSelect),
      UI.field(I18n.t('nearest'), distanceSelect),
      el('label.check', null, [insurerCheck, el('span', {
        text: I18n.t('accepts_my_insurance') +
          (Store.insurerId() ? ' (' + Store.insurerName() + ')' : ' - add it in Profile')
      })]),
      el('label.check', null, [teleCheck, el('span', { text: I18n.t('teleconsult_available') })]),
      el('label.check', null, [schemeCheck, el('span', { text: I18n.t('govt_scheme') })])
    ];

    var close = UI.sheet(I18n.t('filters'), body, [
      UI.button(I18n.t('clear'), {
        variant: 'outline',
        onclick: function () {
          filters.maxFee = 0; filters.minRating = 0; filters.maxDistance = 0;
          filters.insurerOnly = false; filters.teleOnly = false;
          filters.govtSchemeOnly = false;
          close();
          renderResults(target);
        }
      }),
      UI.button(I18n.t('apply'), {
        onclick: function () {
          filters.specialty = specialtySelect.value;
          filters.city = citySelect.value;
          filters.maxFee = Number(feeSelect.value);
          filters.minRating = Number(ratingSelect.value);
          filters.maxDistance = Number(distanceSelect.value);
          filters.insurerOnly = insurerCheck.checked && !!Store.insurerId();
          filters.teleOnly = teleCheck.checked;
          filters.govtSchemeOnly = schemeCheck.checked;
          if (insurerCheck.checked && !Store.insurerId()) {
            UI.snack('Add your insurance in Profile first');
          }
          close();
          if (Router.current().name === 'search') renderResults(target);
          else Router.go('search', {});
        }
      })
    ]);
  }

  // ------------------------------------------------------------------
  // Doctor detail
  // ------------------------------------------------------------------
  Screens.doctor = {
    title: function () { return 'Doctor'; },
    tab: null,
    render: function (params, view) {
      var res = Native.call('doctor', { id: params.id });
      if (!res.ok) {
        view.appendChild(el('div.banner.danger', null, [res.error || 'Not found']));
        return;
      }
      var d = res.doctor;

      view.appendChild(UI.card([
        el('div.doc', null, [
          el('div.avatar', { text: UI.initials(d.name) }),
          el('div.row-left', null, [
            el('div.doc-name', { style: 'font-size:17px', text: d.name }),
            el('div.doc-meta', { text: d.qualification }),
            el('div.small', { style: 'margin-top:4px' }, [
              UI.stars(d.rating),
              el('span.muted', { text: ' ' + Number(d.rating).toFixed(1) +
                ' (' + d.rating_count + ' ratings)' })
            ])
          ])
        ]),
        el('div.wrap', { style: 'margin-top:8px' }, [
          UI.badge(d.specialty, ''),
          UI.badge(d.exp_years + ' ' + I18n.t('years') + ' ' + I18n.t('experience'), 'flat'),
          Number(d.govt_scheme) === 1 ? UI.badge(I18n.t('govt_scheme'), 'flat') : null,
          d.sample ? UI.badge(I18n.t('sample_data'), 'warn') : null
        ]),
        el('p.small', { style: 'margin-top:10px', text: d.bio })
      ]));

      view.appendChild(UI.card([
        el('div.kv', null, [el('span.k', { text: I18n.t('opd_fee') }),
          el('span.v', { text: d.feeBand })]),
        d.teleAvailable ? el('div.kv', null, [el('span.k', { text: I18n.t('teleconsult') }),
          el('span.v', { text: UI.rupees(d.tele_fee) + ' · ' + I18n.t('free_minutes') })]) : null,
        el('div.kv', null, [el('span.k', { text: I18n.t('languages') }),
          el('span.v', { text: String(d.languages).split(',').join(', ') })]),
        el('div.kv', null, [el('span.k', { text: 'Next available' }),
          el('span.v', { text: d.next_slot })]),
        el('div.kv', null, [el('span.k', { text: I18n.t('hospital') }),
          el('span.v', { text: (d.hospital_name || '') + ' · ' + d.distance_km + ' km' })])
      ]));

      view.appendChild(el('div.banner.' + (d.cashlessForYou ? 'info' : 'warn'), null, [
        el('span.banner-icon', { text: d.cashlessForYou ? '✓' : '⚠' }),
        el('span', { text: d.insuranceNote })
      ]));

      // Cost guidance: OPD + the tests this specialty usually advises.
      var codes = [];
      for (var t = 0; t < (d.commonTests || []).length; t++) {
        codes.push(d.commonTests[t].code);
      }
      var est = Native.call('estimate', { doctorId: d.id, tests: codes, city: d.city });
      if (est.ok) {
        view.appendChild(UI.section(I18n.t('estimated_total'), el('div', null, [
          el('div.total-card', null, [
            el('div.sub', { text: I18n.t('total_if_done_nearby') }),
            el('div.amount', { text: UI.band(est.totalMin, est.totalMax) }),
            el('div.sub', { text: I18n.t('opd_fee') + ' ' +
              UI.band(est.opdMin, est.opdMax) + ' + tests ' +
              UI.band(est.testsBestTotal, est.testsTypicalMax) })
          ]),
          est.savings > 0 ? el('div.banner.info', null, [
            el('span.banner-icon', { text: '₹' }),
            el('span', { text: I18n.t('you_could_save') + ' ' + UI.rupees(est.savings) +
              ' by using a partner lab.' })
          ]) : null,
          UI.button(I18n.t('cost_estimate'), {
            block: true, variant: 'ghost',
            onclick: function () {
              Router.go('cost', { tests: codes, doctorId: d.id, city: d.city });
            }
          })
        ])));
      }

      if ((d.commonTests || []).length) {
        var testList = el('div');
        for (var i = 0; i < d.commonTests.length; i++) {
          var ct = d.commonTests[i];
          testList.appendChild(el('div.kv', null, [
            el('span.k', { text: ct.name }),
            el('span.v', { text: UI.band(ct.typical_min, ct.typical_max) })
          ]));
        }
        view.appendChild(UI.section(I18n.t('common_tests'), UI.card([
          testList,
          el('p.tiny.muted', { style: 'margin-top:8px',
            text: 'Indicative only. Your doctor decides which tests you actually need.' })
        ])));
      }

      if ((d.reviews || []).length) {
        var reviews = el('div');
        for (var r = 0; r < d.reviews.length; r++) {
          var rev = d.reviews[r];
          reviews.appendChild(UI.card([
            UI.row([UI.stars(rev.stars)], el('span.tiny.muted', { text: UI.timeAgo(rev.ts) })),
            rev.comment ? el('p.small', { style: 'margin:6px 0 0', text: rev.comment }) : null
          ]));
        }
        view.appendChild(UI.section('Patient feedback', reviews));
      }

      view.appendChild(el('div.btn-grid', null, [
        UI.button(I18n.t('book_teleconsult'), {
          variant: d.teleAvailable ? 'ghost' : 'outline',
          disabled: !d.teleAvailable,
          onclick: function () { Router.go('booking', { doctorId: d.id, kind: 'tele' }); }
        }),
        UI.button(I18n.t('book_visit'), {
          onclick: function () { Router.go('booking', { doctorId: d.id, kind: 'opd' }); }
        })
      ]));

      view.appendChild(el('div.btn-grid', { style: 'margin-top:8px' }, [
        UI.button(I18n.t('check_coverage'), {
          variant: 'outline',
          onclick: function () {
            Router.go('insurance_check', { hospitalId: d.hospital_id });
          }
        }),
        UI.button(I18n.t('share_app'), {
          variant: 'outline',
          onclick: function () {
            Native.share(d.name + ' (' + d.specialty + ') at ' + d.hospital_name +
              ', ' + d.city + '. OPD ' + d.feeBand +
              '. Shared from Medical Navigator (sample pilot data).');
          }
        })
      ]));
    }
  };

  // ------------------------------------------------------------------
  // Hospitals list
  // ------------------------------------------------------------------
  Screens.hospitals = {
    title: function () { return I18n.t('hospital'); },
    tab: null,
    render: function (params, view) {
      var cityRow = el('div.wrap', { style: 'margin-bottom:10px' });
      var chosenCity = params.city !== undefined ? params.city : Store.city();
      var cities = [''].concat(Store.state.cities);
      for (var i = 0; i < cities.length; i++) {
        (function (city) {
          cityRow.appendChild(UI.chip(city || 'All', {
            active: chosenCity === city,
            onclick: function () { Router.go('hospitals', { city: city }, { replace: true }); }
          }));
        }(cities[i]));
      }
      view.appendChild(cityRow);

      var res = Native.call('hospitals', {
        city: chosenCity, insurerId: ''
      });
      if (!res.ok || !res.hospitals.length) {
        view.appendChild(UI.empty('No hospitals listed for this city yet.'));
        return;
      }
      for (var h = 0; h < res.hospitals.length; h++) {
        var hosp = res.hospitals[h];
        hosp.cashlessForYou = Store.insurerId() &&
          (hosp.cashless || '').split(',').indexOf(Store.insurerId()) >= 0;
        view.appendChild(Cards.hospital(hosp));
      }
    }
  };

  // ------------------------------------------------------------------
  // Booking
  // ------------------------------------------------------------------
  Screens.booking = {
    title: function (p) {
      return p.kind === 'tele' ? I18n.t('book_teleconsult') : I18n.t('book_visit');
    },
    tab: null,
    render: function (params, view) {
      var res = Native.call('doctor', { id: params.doctorId });
      if (!res.ok) {
        view.appendChild(el('div.banner.danger', null, [res.error || 'Not found']));
        return;
      }
      var d = res.doctor;
      var kind = params.kind || 'tele';
      var fee = kind === 'tele' ? Number(d.tele_fee) : Number(d.opd_fee_min);

      view.appendChild(UI.card([
        UI.row([
          el('div.strong', { text: d.name }),
          el('div.small.muted', { text: d.specialty + ' · ' + d.hospital_name })
        ], [
          el('div.fee-label', { text: kind === 'tele' ? I18n.t('teleconsult') : I18n.t('opd_fee') }),
          el('div.fee', { text: UI.rupees(fee) })
        ])
      ]));

      if (kind === 'tele') {
        view.appendChild(el('div.banner.info', null, [
          el('span.banner-icon', { text: '⏱' }),
          el('span', { text: I18n.t('free_minutes') + '. After that the consult is ' +
            UI.rupees(fee) + '.' })
        ]));
      }

      var slots = buildSlots(kind, d.next_slot);
      var chosen = { slot: slots[0] };
      var slotWrap = el('div.wrap');
      for (var i = 0; i < slots.length; i++) {
        (function (slot, chip) {
          chip = UI.chip(slot, {
            active: chosen.slot === slot,
            onclick: function () {
              chosen.slot = slot;
              var kids = slotWrap.childNodes;
              for (var k = 0; k < kids.length; k++) {
                kids[k].className = 'chip' + (kids[k].textContent === slot ? ' active' : '');
              }
            }
          });
          slotWrap.appendChild(chip);
        }(slots[i]));
      }
      view.appendChild(UI.section('Pick a slot', UI.card([slotWrap])));

      var reason = UI.el('textarea.input', {
        placeholder: 'What should the doctor know? e.g. sugar high for 2 weeks, taking metformin'
      });
      view.appendChild(UI.section('Reason for the consult', UI.card([reason])));

      view.appendChild(UI.card([
        el('div.kv', null, [el('span.k', { text: 'Consult fee' }),
          el('span.v', { text: UI.rupees(fee) })]),
        el('div.kv', null, [el('span.k', { text: 'Platform fee' }),
          el('span.v', { text: UI.rupees(0) })]),
        el('div.kv', null, [el('span.k', { text: 'To pay now' }),
          el('span.v', { text: kind === 'tele' ? UI.rupees(0) + ' (first 10 min free)'
            : UI.rupees(0) + ' (pay at hospital)' })])
      ]));

      view.appendChild(UI.button('Confirm booking', {
        block: true,
        onclick: function () {
          var created = Native.call('create_booking', {
            doctorId: d.id, kind: kind, slot: chosen.slot,
            reason: String(reason.value).trim()
          });
          if (!created.ok) {
            UI.snack(created.error || 'Could not book');
            return;
          }
          Native.tap(20);
          UI.snack('Booked with ' + d.name + ' · ' + chosen.slot);
          if (kind === 'tele') Router.go('chat', { bookingId: created.bookingId });
          else Router.go('bookings', {});
        }
      }));
      view.appendChild(el('p.tiny.muted.center', {
        text: 'Demo build: no payment gateway and no real appointment is created.'
      }));
    }
  };

  /** Simple slot generator; a real build reads the doctor's calendar. */
  function buildSlots(kind, nextSlot) {
    if (kind === 'tele') {
      return ['Now (chat)', 'Today 8:00 PM', 'Tomorrow 9:00 AM', 'Tomorrow 7:00 PM'];
    }
    var out = [nextSlot || 'Tomorrow 10:00 AM'];
    out.push('Tomorrow 11:30 AM');
    out.push('Tomorrow 5:00 PM');
    out.push('Day after 10:00 AM');
    return out;
  }

  // ------------------------------------------------------------------
  // Teleconsult chat
  // ------------------------------------------------------------------
  Screens.chat = {
    title: function () { return I18n.t('chat_with_doctor'); },
    tab: null,
    fullBleed: true,
    render: function (params, view) {
      var wrap = el('div.chat-wrap');
      var list = el('div.chat-list');
      var composer = el('div.composer');

      function refresh() {
        UI.clear(list);
        list.appendChild(el('div.banner.info', null, [
          el('span.banner-icon', { text: 'ℹ' }),
          el('span', { text: 'Demo build: replies come from a fixed rule table, not a '
            + 'live doctor. Never rely on this for urgent problems.' })
        ]));
        var res = Native.call('messages', { bookingId: params.bookingId });
        if (res.ok) {
          for (var i = 0; i < res.messages.length; i++) {
            var m = res.messages[i];
            list.appendChild(el('div.bubble.' + (m.sender === 'doctor' ? 'doctor' : 'patient'),
              null, [
                el('span', { text: m.body }),
                el('span.bubble-time', { text: UI.clock(m.ts) })
              ]));
          }
        }
        list.scrollTop = list.scrollHeight;
      }

      var input = UI.input({ placeholder: I18n.t('type_message') });
      function send() {
        var body = String(input.value).trim();
        if (!body) return;
        input.value = '';
        var res = Native.call('send_message', {
          bookingId: params.bookingId, body: body
        });
        if (!res.ok) UI.snack(res.error || 'Could not send');
        refresh();
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') send();
      });
      composer.appendChild(input);
      composer.appendChild(UI.button(I18n.t('send'), { onclick: send }));

      wrap.appendChild(list);
      wrap.appendChild(composer);
      view.appendChild(wrap);
      refresh();
      window.setTimeout(function () { list.scrollTop = list.scrollHeight; }, 60);
    }
  };

  // ------------------------------------------------------------------
  // Rating
  // ------------------------------------------------------------------
  Screens.rate = {
    title: function () { return I18n.t('rate_visit'); },
    tab: null,
    render: function (params, view) {
      var all = Native.call('bookings', {});
      var booking = null;
      if (all.ok) {
        for (var i = 0; i < all.bookings.length; i++) {
          if (all.bookings[i].id === params.bookingId) booking = all.bookings[i];
        }
      }
      if (!booking) {
        view.appendChild(UI.empty('Booking not found.'));
        return;
      }

      var picks = { doctor: 0, hospital: 0, insurance: 0 };
      var comment = UI.el('textarea.input', {
        placeholder: 'What went well, what did not? (optional)'
      });

      view.appendChild(UI.card([
        el('div.strong', { text: booking.doctor_name }),
        el('div.small.muted', { text: (booking.specialty || '') + ' · ' +
          (booking.hospital_name || '') })
      ]));

      function starBlock(key, label) {
        var value = el('span.small.muted', { text: 'not rated' });
        var row = UI.card([
          el('div.strong', { text: label }),
          el('div', { style: 'margin-top:6px' }, [
            UI.stars(0, function (n) {
              picks[key] = n;
              value.textContent = n + ' / 5';
              UI.clear(row.childNodes[1]);
              row.childNodes[1].appendChild(UI.stars(n, function (m) {
                picks[key] = m;
                value.textContent = m + ' / 5';
              }));
              row.childNodes[1].appendChild(value);
              Native.tap(10);
            }),
            value
          ])
        ]);
        return row;
      }

      view.appendChild(starBlock('doctor', I18n.t('rate_doctor')));
      view.appendChild(starBlock('hospital', I18n.t('rate_hospital')));
      view.appendChild(starBlock('insurance', I18n.t('rate_insurance')));
      view.appendChild(UI.card([comment]));

      view.appendChild(UI.button(I18n.t('submit_rating'), {
        block: true,
        onclick: function () {
          if (!picks.doctor && !picks.hospital && !picks.insurance) {
            UI.snack('Please give at least one rating');
            return;
          }
          if (picks.doctor) {
            Native.call('rate', {
              targetKind: 'doctor', targetId: booking.doctor_id,
              stars: picks.doctor, comment: String(comment.value).trim(),
              bookingId: booking.id
            });
          }
          if (picks.hospital) {
            Native.call('rate', {
              targetKind: 'hospital', targetId: hospitalIdOf(booking),
              stars: picks.hospital, comment: '', bookingId: booking.id
            });
          }
          if (picks.insurance) {
            Native.call('rate', {
              targetKind: 'insurance', targetId: Store.insurerId(),
              stars: picks.insurance, comment: '', bookingId: booking.id
            });
          }
          UI.snack(I18n.t('thanks_rating'));
          Router.go('bookings', {}, { replace: true });
        }
      }));
    }
  };

  function hospitalIdOf(booking) {
    var res = Native.call('doctor', { id: booking.doctor_id });
    return res.ok ? res.doctor.hospital_id : '';
  }
}());
