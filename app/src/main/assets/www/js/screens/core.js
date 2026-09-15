/* Onboarding, home and emergency screens. */
(function () {
  'use strict';
  var el = UI.el;

  // ------------------------------------------------------------------
  // Onboarding: language -> mobile OTP -> profile
  // ------------------------------------------------------------------
  var draft = { step: 0, phone: '', otp: '', typedOtp: '', conditions: [] };

  Screens.onboarding = {
    title: function () { return I18n.t('app_name'); },
    tab: null,
    render: function (params, view) {
      view.appendChild(el('div.progress', null, [
        el('span' + (draft.step >= 0 ? '.on' : '')),
        el('span' + (draft.step >= 1 ? '.on' : '')),
        el('span' + (draft.step >= 2 ? '.on' : ''))
      ]));
      if (draft.step === 0) stepLanguage(view);
      else if (draft.step === 1) stepOtp(view);
      else stepProfile(view);
    }
  };

  function stepLanguage(view) {
    view.appendChild(el('div.hero', null, [
      el('h1', { text: I18n.t('app_name') }),
      el('p', { text: I18n.t('tagline') })
    ]));
    view.appendChild(UI.section(I18n.t('choose_language'), (function () {
      var grid = el('div.lang-grid');
      for (var i = 0; i < I18n.codes.length; i++) {
        (function (code) {
          grid.appendChild(el('button.lang-opt' + (I18n.get() === code ? ' active' : ''), {
            text: I18n.name(code),
            onclick: function () {
              I18n.set(code);
              Native.tap(12);
              Router.render();
            }
          }));
        }(I18n.codes[i]));
      }
      return grid;
    }())));
    view.appendChild(UI.button(I18n.t('get_started'), {
      block: true,
      onclick: function () {
        draft.step = 1;
        Native.track('onboarding_language', I18n.get());
        Router.render();
      }
    }));
    view.appendChild(el('p.tiny.muted.center', {
      text: I18n.t('not_medical_advice'), style: 'margin-top:14px'
    }));
  }

  function stepOtp(view) {
    view.appendChild(el('h1', { text: I18n.t('phone_login'), style: 'font-size:20px' }));
    view.appendChild(el('p.small.muted', { text: I18n.t('phone_hint') }));

    var phoneInput = UI.input({
      type: 'tel', inputmode: 'numeric', maxlength: 10,
      placeholder: '9876543210', value: draft.phone
    });
    var otpBox = el('div');

    view.appendChild(UI.card([
      UI.field(I18n.t('mobile_number'), phoneInput),
      otpBox
    ]));

    function renderOtpStage() {
      UI.clear(otpBox);
      if (!draft.otp) {
        otpBox.appendChild(UI.button(I18n.t('send_otp'), {
          block: true,
          onclick: function () {
            var digits = String(phoneInput.value).replace(/[^0-9]/g, '');
            if (digits.length !== 10) {
              UI.snack('Enter a 10-digit mobile number');
              return;
            }
            draft.phone = digits;
            // Demo build: no SMS gateway is wired up, so the code is generated
            // and shown locally. Phase-I swaps this for MSG91 / Twilio.
            draft.otp = String(Math.floor(1000 + Math.random() * 9000));
            Native.track('otp_requested', '');
            renderOtpStage();
          }
        }));
        return;
      }
      otpBox.appendChild(el('div.banner.info', null, [
        el('span.banner-icon', { text: 'ℹ' }),
        el('span', { text: I18n.t('demo_otp_note') + '  OTP: ' + draft.otp })
      ]));
      var otpInput = UI.input({
        type: 'tel', inputmode: 'numeric', maxlength: 4, placeholder: '• • • •'
      });
      otpBox.appendChild(UI.field(I18n.t('enter_otp'), otpInput));
      otpBox.appendChild(UI.button(I18n.t('verify'), {
        block: true,
        onclick: function () {
          if (String(otpInput.value).trim() !== draft.otp) {
            UI.snack('That OTP does not match');
            Native.tap(40);
            return;
          }
          Store.saveProfile({ phone: draft.phone });
          Native.track('otp_verified', '');
          draft.step = 2;
          Router.render();
        }
      }));
      otpBox.appendChild(UI.button(I18n.t('send_otp'), {
        variant: 'ghost', block: true,
        onclick: function () {
          draft.otp = String(Math.floor(1000 + Math.random() * 9000));
          renderOtpStage();
        }
      }));
    }
    renderOtpStage();
  }

  function stepProfile(view) {
    var p = Store.profile();
    view.appendChild(el('h1', { text: I18n.t('your_details'), style: 'font-size:20px' }));
    view.appendChild(el('p.small.muted', {
      text: 'This stays on your phone. It is used to filter doctors by city, cost and your insurance.'
    }));

    var nameInput = UI.input({ placeholder: 'e.g. Sunita Devi', value: p.name || '' });
    var ageInput = UI.input({ type: 'tel', inputmode: 'numeric', maxlength: 3,
      placeholder: '45', value: p.age || '' });
    var sexSelect = UI.select([
      { value: 'female', label: I18n.t('female') },
      { value: 'male', label: I18n.t('male') },
      { value: 'other', label: I18n.t('other') }
    ], p.sex || 'female');
    var citySelect = UI.select(Store.state.cities, p.city || Store.state.cities[0]);

    var conditionWrap = el('div.wrap');
    draft.conditions = (p.conditions ? String(p.conditions).split(',') : []);
    for (var i = 0; i < Store.state.conditions.length; i++) {
      (function (cond) {
        var active = draft.conditions.indexOf(cond.id) >= 0;
        var chip = UI.chip(cond.label, {
          active: active,
          onclick: function () {
            var idx = draft.conditions.indexOf(cond.id);
            if (idx >= 0) draft.conditions.splice(idx, 1);
            else draft.conditions.push(cond.id);
            chip.className = 'chip' + (draft.conditions.indexOf(cond.id) >= 0 ? ' active' : '');
          }
        });
        conditionWrap.appendChild(chip);
      }(Store.state.conditions[i]));
    }

    var insurerOptions = [{ value: '', label: '-- none --' }];
    for (var j = 0; j < Store.state.insurers.length; j++) {
      insurerOptions.push({
        value: Store.state.insurers[j].id,
        label: Store.state.insurers[j].name
      });
    }
    var planInput = UI.input({ placeholder: 'e.g. Silver', value: p.plan || '' });
    var insurerSelect = UI.select(insurerOptions, p.insurer_id || '', function (v) {
      var ins = Store.insurer(v);
      planInput.parentNode.style.display = (v && ins && ins.kind === 'insurer') ? '' : 'none';
    });
    var abhaInput = UI.input({ placeholder: '14-digit ABHA number', value: p.abha || '' });

    view.appendChild(UI.card([
      UI.field(I18n.t('full_name'), nameInput),
      el('div.field-grid', null, [
        UI.field(I18n.t('age'), ageInput),
        UI.field(I18n.t('sex'), sexSelect)
      ]),
      UI.field(I18n.t('city'), citySelect)
    ]));

    view.appendChild(UI.section(I18n.t('conditions_you_have'), UI.card([conditionWrap])));

    view.appendChild(UI.section(I18n.t('insurance_optional'), UI.card([
      UI.field(I18n.t('insurer'), insurerSelect),
      UI.field(I18n.t('plan'), planInput),
      UI.field(I18n.t('abha_optional'), abhaInput,
        'Used later to link records under ABDM. Optional in this build.')
    ])));

    var planField = planInput.parentNode;
    planField.style.display = (p.insurer_id && Store.insurer(p.insurer_id)
      && Store.insurer(p.insurer_id).kind === 'insurer') ? '' : 'none';

    view.appendChild(UI.button(I18n.t('save'), {
      block: true,
      onclick: function () {
        if (!String(nameInput.value).trim()) {
          UI.snack('Please enter your name');
          return;
        }
        Store.saveProfile({
          name: String(nameInput.value).trim(),
          age: String(ageInput.value).trim(),
          sex: sexSelect.value,
          city: citySelect.value,
          conditions: draft.conditions.join(','),
          insurer_id: insurerSelect.value,
          plan: planInput.value,
          abha: abhaInput.value,
          lang: I18n.get(),
          onboarded: '1'
        });
        Native.track('onboarding_complete', 'city=' + citySelect.value);
        UI.snack('Welcome, ' + String(nameInput.value).trim().split(' ')[0]);
        Router.tab('home');
      }
    }));
  }

  // ------------------------------------------------------------------
  // Home
  // ------------------------------------------------------------------
  Screens.home = {
    title: function () {
      var name = Store.profile().name;
      return name ? ('Namaskar, ' + String(name).split(' ')[0]) : I18n.t('app_name');
    },
    subtitle: function () {
      var bits = [];
      if (Store.city()) bits.push(Store.city());
      if (Store.insurerId()) bits.push(Store.insurerName());
      return bits.join(' · ');
    },
    tab: 'home',
    render: function (params, view) {
      view.appendChild(Chrome.demoBanner());

      view.appendChild(el('div.hero', null, [
        el('h1', { text: I18n.t('what_troubles_you') }),
        el('p', { text: I18n.t('tagline') }),
        el('div.hero-pills', null, [
          el('span.hero-pill', { text: Store.state.specialties.length + ' specialties' }),
          el('span.hero-pill', { text: Store.state.cities.length + ' cities' }),
          el('span.hero-pill', { text: 'Works offline' })
        ])
      ]));

      var symptomInput = UI.input({
        placeholder: I18n.t('symptom_hint'),
        style: 'margin-bottom:8px'
      });
      symptomInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runTriage();
      });
      function runTriage() {
        var text = String(symptomInput.value).trim();
        if (text.length < 2) {
          UI.snack('Please describe the problem in a few words');
          return;
        }
        Router.go('triage', { text: text });
      }
      view.appendChild(UI.card([
        symptomInput,
        UI.button(I18n.t('check'), { block: true, onclick: runTriage })
      ]));

      var actions = el('div.action-grid');
      actions.appendChild(action('⚕', I18n.t('find_doctor'),
        'Filter by fee, insurance, distance', function () { Router.tab('find'); }));
      actions.appendChild(action('₹', I18n.t('cost_estimate'),
        'OPD + tests, before you go', function () { Router.tab('cost'); }));
      actions.appendChild(action('⛨', I18n.t('insurance_help'),
        'Cashless, pre-auth, documents', function () { Router.tab('insurance'); }));
      actions.appendChild(action('☑', I18n.t('my_visits'),
        'Bookings and teleconsults', function () { Router.go('bookings', {}); }));
      view.appendChild(UI.section(null, actions));

      var emergency = el('button.action.alert', {
        onclick: function () { Router.go('emergency', {}); }
      }, [
        el('span.action-icon', { text: '⚠' }),
        el('span.action-label', { text: I18n.t('emergency') }),
        el('span.action-sub', { text: I18n.t('emergency_note') })
      ]);
      emergency.style.width = '100%';
      view.appendChild(emergency);

      // Ongoing conditions -> one-tap route to the right specialist.
      var mine = (Store.profile().conditions || '').split(',');
      var chips = el('div.wrap');
      var added = 0;
      for (var i = 0; i < Store.state.conditions.length; i++) {
        var cond = Store.state.conditions[i];
        if (mine.indexOf(cond.id) < 0) continue;
        (function (c) {
          chips.appendChild(UI.chip(c.label + ' → ' + c.specialty, {
            onclick: function () {
              Router.go('search', { specialty: c.specialty, city: Store.city() });
            }
          }));
        }(cond));
        added++;
      }
      if (added) {
        view.appendChild(UI.section('Your ongoing care', UI.card([
          el('p.small.muted', { text: 'Jump straight to the right specialist' }),
          chips
        ])));
      }

      var bookings = Native.call('bookings', {});
      if (bookings.ok && bookings.bookings && bookings.bookings.length) {
        var list = el('div');
        var shown = Math.min(2, bookings.bookings.length);
        for (var b = 0; b < shown; b++) {
          list.appendChild(Cards.booking(bookings.bookings[b]));
        }
        view.appendChild(UI.section(I18n.t('my_visits'), list,
          el('button.block-link', {
            text: 'See all',
            onclick: function () { Router.go('bookings', {}); }
          })));
      }

      view.appendChild(Chrome.adviceBanner());
    }
  };

  function action(icon, label, sub, onclick) {
    return el('button.action', { onclick: onclick }, [
      el('span.action-icon', { text: icon }),
      el('span.action-label', { text: label }),
      el('span.action-sub', { text: sub })
    ]);
  }

  // ------------------------------------------------------------------
  // Emergency
  // ------------------------------------------------------------------
  Screens.emergency = {
    title: function () { return I18n.t('emergency'); },
    tab: null,
    render: function (params, view) {
      view.appendChild(el('div.banner.danger', null, [
        el('span.banner-icon', { text: '⚠' }),
        el('span', { text: I18n.t('emergency_note') })
      ]));

      // Public national / state helplines.
      var lines = [
        { label: I18n.t('ambulance'), number: '108' },
        { label: 'National emergency (112)', number: '112' },
        { label: I18n.t('national_helpline'), number: '104' },
        { label: I18n.t('mental_health'), number: '14416' },
        { label: I18n.t('child_helpline'), number: '1098' },
        { label: I18n.t('women_helpline'), number: '181' },
        { label: I18n.t('pmjay_helpline'), number: '14555' }
      ];
      var callList = el('div');
      for (var i = 0; i < lines.length; i++) {
        (function (line) {
          callList.appendChild(UI.card([
            UI.row(
              [el('div.strong', { text: line.label }),
               el('div.small.muted', { text: line.number })],
              UI.button(I18n.t('call_now'), {
                variant: 'ghost', block: false,
                onclick: function () {
                  Native.track('emergency_call', line.number);
                  Native.dial(line.number);
                }
              })
            )
          ]));
        }(lines[i]));
      }
      view.appendChild(UI.section('Helplines', callList));

      var res = Native.call('hospitals', {
        city: Store.city(), emergencyOnly: true
      });
      var hospitals = el('div');
      if (res.ok && res.hospitals.length) {
        for (var h = 0; h < res.hospitals.length; h++) {
          hospitals.appendChild(Cards.hospital(res.hospitals[h]));
        }
      } else {
        hospitals.appendChild(UI.empty('No emergency hospital listed for your city yet.'));
      }
      view.appendChild(UI.section(I18n.t('nearest_emergency'), hospitals));
    }
  };
}());
