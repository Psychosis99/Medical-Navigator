/* Insurance hub: coverage check, network list, policy reader, claim tracker. */
(function () {
  'use strict';
  var el = UI.el;

  Screens.insurance = {
    title: function () { return I18n.t('insurance_help'); },
    subtitle: function () { return Store.insurerName() || 'No insurer added'; },
    tab: 'insurance',
    render: function (params, view) {
      view.appendChild(el('div.banner.warn', null, [
        el('span.banner-icon', { text: '⚠' }),
        el('span', { text: 'Policy text in this build is illustrative sample wording. '
          + 'Always check your own policy document and insurer helpline.' })
      ]));

      if (!Store.insurerId()) {
        view.appendChild(UI.card([
          el('div.strong', { text: 'Add your insurance or scheme' }),
          el('p.small.muted', { text: 'Then the app can tell you which hospitals are '
            + 'cashless for you and what to carry.' }),
          UI.button(I18n.t('profile'), {
            block: true,
            onclick: function () { Router.go('profile', {}); }
          })
        ]));
      } else {
        var ins = Store.insurer();
        view.appendChild(UI.card([
          UI.row([
            el('div.strong', { text: ins.name }),
            el('div.small.muted', { text: (ins.kind === 'scheme'
              ? 'Government scheme' : 'Private insurer') +
              (Store.profile().plan ? ' · ' + Store.profile().plan : '') }),
            el('div.tiny.muted', { text: ins.note })
          ], [
            UI.button(I18n.t('call_now'), {
              variant: 'ghost',
              onclick: function () { Native.dial(ins.helpline); }
            })
          ])
        ]));
      }

      var actions = el('div.action-grid');
      actions.appendChild(act('✓', I18n.t('check_coverage'),
        'Is this hospital cashless for me?', function () {
          Router.go('insurance_check', {});
        }));
      actions.appendChild(act('⛨', I18n.t('network_hospital'),
        'Hospitals that settle your cover', function () {
          Router.go('network', {});
        }));
      actions.appendChild(act('☷', I18n.t('policy_points'),
        'What is covered, what is not', function () {
          Router.go('policy', {});
        }));
      actions.appendChild(act('✉', 'Claim tracker',
        'Keep a claim on the rails', function () {
          Router.go('claims', {});
        }));
      view.appendChild(UI.section(null, actions));

      view.appendChild(UI.section('Before any planned admission', UI.card([
        el('div.steps', null, [
          step('1', 'Check the hospital is in your network',
            'Cashless only works at an empanelled hospital. The network list changes, '
            + 'so confirm on the day.'),
          step('2', 'Ask the insurance desk to raise pre-authorisation',
            'At least 48 hours before a planned admission, or within 24 hours of an emergency.'),
          step('3', 'Carry your card, ID and old reports',
            'Missing documents are the most common reason a claim stalls.'),
          step('4', 'Get the approved amount in writing',
            'And ask what is excluded - consumables and room upgrades usually are.')
        ])
      ])));
    }
  };

  function act(icon, label, sub, onclick) {
    return el('button.action', { onclick: onclick }, [
      el('span.action-icon', { text: icon }),
      el('span.action-label', { text: label }),
      el('span.action-sub', { text: sub })
    ]);
  }

  function step(n, title, detail) {
    return el('div.step', null, [
      el('div.step-num', { text: n }),
      el('div.row-left', null, [
        el('div.step-title', { text: title }),
        el('div.step-detail', { text: detail })
      ])
    ]);
  }

  // ------------------------------------------------------------------
  // Coverage check
  // ------------------------------------------------------------------
  Screens.insurance_check = {
    title: function () { return I18n.t('check_coverage'); },
    tab: null,
    render: function (params, view) {
      var chosen = { hospitalId: params.hospitalId || '' };

      var hospitalRes = Native.call('hospitals', { city: '' });
      var options = [{ value: '', label: '-- pick a hospital --' }];
      if (hospitalRes.ok) {
        for (var i = 0; i < hospitalRes.hospitals.length; i++) {
          var h = hospitalRes.hospitals[i];
          options.push({ value: h.id, label: h.name + ' · ' + h.city });
        }
      }

      var insurerOptions = [];
      for (var j = 0; j < Store.state.insurers.length; j++) {
        insurerOptions.push({
          value: Store.state.insurers[j].id, label: Store.state.insurers[j].name
        });
      }
      if (!insurerOptions.length) insurerOptions.push({ value: '', label: 'none' });

      var result = el('div');
      var insurerSelect = UI.select(insurerOptions,
        Store.insurerId() || insurerOptions[0].value, function () { run(); });
      var hospitalSelect = UI.select(options, chosen.hospitalId, function (v) {
        chosen.hospitalId = v;
        run();
      });

      view.appendChild(UI.card([
        UI.field(I18n.t('insurer'), insurerSelect),
        UI.field(I18n.t('hospital'), hospitalSelect)
      ]));
      view.appendChild(result);

      function run() {
        UI.clear(result);
        if (!hospitalSelect.value) {
          result.appendChild(UI.empty('Pick a hospital to check cashless status.', '⛨'));
          return;
        }
        var res = Native.call('insurance_check', {
          insurerId: insurerSelect.value,
          hospitalId: hospitalSelect.value,
          plan: Store.profile().plan || ''
        });
        if (!res.ok) {
          result.appendChild(el('div.banner.danger', null, [res.error || 'Check failed']));
          return;
        }

        result.appendChild(el('div.banner.' + (res.network ? 'info' : 'warn'), null, [
          el('span.banner-icon', { text: res.network ? '✓' : '⚠' }),
          el('span', { text: res.network
            ? I18n.t('network_hospital') + ' — ' + I18n.t('cashless_possible') +
              ' with pre-authorisation.'
            : I18n.t('not_in_network') + ' — you will likely pay first and claim later.' })
        ]));

        if (res.hospital) {
          var h = res.hospital;
          h.cashlessForYou = res.network;
          result.appendChild(Cards.hospital(h, { hideCoverage: true }));
        }

        var steps = el('div.steps');
        for (var s = 0; s < res.steps.length; s++) {
          steps.appendChild(step(res.steps[s].n, res.steps[s].title, res.steps[s].detail));
        }
        result.appendChild(UI.section(I18n.t('steps_to_follow'), UI.card([steps])));

        var ul = el('ul.checklist');
        for (var c = 0; c < res.checklist.length; c++) {
          ul.appendChild(el('li', null, [el('span', { text: res.checklist[c] })]));
        }
        result.appendChild(UI.section(I18n.t('what_to_carry'), UI.card([ul])));

        if (res.clauses && res.clauses.length) {
          var clauses = el('div');
          for (var k = 0; k < res.clauses.length; k++) {
            clauses.appendChild(Cards.clause(res.clauses[k]));
          }
          result.appendChild(UI.section(I18n.t('policy_points'), clauses));
        }

        result.appendChild(el('div.btn-grid', null, [
          UI.button('Track a claim', {
            variant: 'ghost',
            onclick: function () {
              Router.go('claims', {
                newClaim: {
                  hospitalId: hospitalSelect.value,
                  insurerId: insurerSelect.value,
                  route: res.route
                }
              });
            }
          }),
          UI.button(I18n.t('share_app'), {
            variant: 'outline',
            onclick: function () {
              var lines = ['Medical Navigator - insurance check'];
              lines.push('Hospital: ' + (res.hospital ? res.hospital.name : '-'));
              lines.push('Cover: ' + (res.insurer ? res.insurer.name : '-'));
              lines.push('Status: ' + (res.network ? 'in network (cashless possible)'
                : 'not in network (reimbursement)'));
              lines.push('Carry: ' + res.checklist.join(', '));
              lines.push('(Sample pilot data.)');
              Native.share(lines.join('\n'));
            }
          })
        ]));

        if (res.networkHospitals && res.networkHospitals.length && !res.network) {
          var alt = el('div');
          for (var n = 0; n < res.networkHospitals.length && n < 4; n++) {
            var nh = res.networkHospitals[n];
            nh.cashlessForYou = true;
            alt.appendChild(Cards.hospital(nh, { hideCoverage: true }));
          }
          result.appendChild(UI.section('Cashless alternatives near you', alt));
        }
      }
      run();
    }
  };

  // ------------------------------------------------------------------
  // Network hospitals
  // ------------------------------------------------------------------
  Screens.network = {
    title: function () { return I18n.t('network_hospital'); },
    subtitle: function () { return Store.insurerName(); },
    tab: null,
    render: function (params, view) {
      if (!Store.insurerId()) {
        view.appendChild(UI.empty('Add your insurer in Profile to see your network.', '⛨'));
        return;
      }
      var cityRow = el('div.wrap', { style: 'margin-bottom:10px' });
      var chosenCity = params.city !== undefined ? params.city : '';
      var cities = [''].concat(Store.state.cities);
      for (var i = 0; i < cities.length; i++) {
        (function (city) {
          cityRow.appendChild(UI.chip(city || 'All cities', {
            active: chosenCity === city,
            onclick: function () { Router.go('network', { city: city }, { replace: true }); }
          }));
        }(cities[i]));
      }
      view.appendChild(cityRow);

      var res = Native.call('hospitals', {
        city: chosenCity, insurerId: Store.insurerId()
      });
      if (!res.ok || !res.hospitals.length) {
        view.appendChild(UI.empty('No cashless hospital listed for this cover here yet.'));
        return;
      }
      for (var h = 0; h < res.hospitals.length; h++) {
        view.appendChild(Cards.hospital(res.hospitals[h]));
      }
    }
  };

  // ------------------------------------------------------------------
  // Policy reader
  // ------------------------------------------------------------------
  Screens.policy = {
    title: function () { return I18n.t('policy_points'); },
    tab: null,
    render: function (params, view) {
      var insurerOptions = [];
      for (var j = 0; j < Store.state.insurers.length; j++) {
        insurerOptions.push({
          value: Store.state.insurers[j].id, label: Store.state.insurers[j].name
        });
      }
      var body = el('div');
      var insurerSelect = UI.select(insurerOptions,
        Store.insurerId() || (insurerOptions[0] || {}).value, function () { run(); });
      view.appendChild(UI.card([UI.field(I18n.t('insurer'), insurerSelect)]));

      view.appendChild(UI.card([
        el('div.strong', { text: 'Upload your policy PDF' }),
        el('p.small.muted', { style: 'margin:4px 0 8px',
          text: 'In this build the reader shows pre-parsed sample clauses instead of '
            + 'parsing your file, exactly as scoped for the MVP. Document parsing is a '
            + 'Phase-II item.' }),
        UI.button('Use sample clauses', {
          block: true, variant: 'ghost',
          onclick: function () {
            Native.track('policy_reader_opened', insurerSelect.value);
            UI.snack('Showing sample clauses for this cover');
            run();
          }
        })
      ]));
      view.appendChild(body);

      function run() {
        UI.clear(body);
        var res = Native.call('policy', { insurerId: insurerSelect.value });
        if (!res.ok || !res.clauses.length) {
          body.appendChild(UI.empty('No clause text available for this cover.'));
          return;
        }
        var groups = ['covered', 'limit', 'waiting', 'excluded', 'process'];
        var labels = {
          covered: I18n.t('covered'), limit: I18n.t('limits'),
          waiting: I18n.t('waiting'), excluded: I18n.t('excluded'),
          process: I18n.t('process')
        };
        for (var g = 0; g < groups.length; g++) {
          var wrap = el('div');
          var found = 0;
          for (var i = 0; i < res.clauses.length; i++) {
            if (res.clauses[i].kind !== groups[g]) continue;
            wrap.appendChild(Cards.clause(res.clauses[i]));
            found++;
          }
          if (found) body.appendChild(UI.section(labels[groups[g]], wrap));
        }
      }
      run();
    }
  };

  // ------------------------------------------------------------------
  // Claim tracker
  // ------------------------------------------------------------------
  Screens.claims = {
    title: function () { return 'Claim tracker'; },
    tab: null,
    render: function (params, view) {
      if (params.newClaim) {
        var prefill = params.newClaim;
        params.newClaim = null;   // one-shot: do not re-open on the next render
        openClaimSheet(prefill, view);
      }
      view.appendChild(UI.button('Add a claim', {
        block: true, variant: 'ghost',
        onclick: function () { openClaimSheet({}, view); }
      }));

      var res = Native.call('claims', {});
      if (!res.ok || !res.claims.length) {
        view.appendChild(UI.empty('No claim being tracked yet.', '✉'));
        return;
      }
      var STAGES = ['started', 'pre-auth sent', 'approved', 'submitted', 'settled'];
      for (var i = 0; i < res.claims.length; i++) {
        (function (claim) {
          var idx = STAGES.indexOf(claim.status);
          view.appendChild(UI.card([
            UI.row([
              el('div.strong', { text: claim.hospital_name || 'Hospital' }),
              el('div.small.muted', { text: (claim.insurer_name || '') + ' · ' +
                claim.route }),
              el('div.tiny.muted', { text: UI.timeAgo(claim.created_ts) })
            ], [
              UI.badge(claim.status, idx >= 2 ? 'good' : 'warn'),
              claim.amount ? el('div.small.strong', { style: 'margin-top:4px',
                text: UI.rupees(claim.amount) }) : null
            ]),
            el('div.progress', { style: 'margin:10px 0 6px' }, (function () {
              var bars = [];
              for (var s = 0; s < STAGES.length; s++) {
                bars.push(el('span' + (s <= idx ? '.on' : '')));
              }
              return bars;
            }())),
            el('div.tiny.muted', { text: STAGES.join('  →  ') }),
            claim.notes ? el('p.small', { style: 'margin-top:8px', text: claim.notes }) : null,
            el('div.btn-grid', { style: 'margin-top:10px' }, [
              UI.button('Next stage', {
                variant: 'ghost',
                disabled: idx >= STAGES.length - 1,
                onclick: function () {
                  Native.call('save_claim', {
                    id: claim.id, hospitalId: claim.hospital_id,
                    insurerId: claim.insurer_id, plan: claim.plan,
                    route: claim.route, amount: claim.amount, notes: claim.notes,
                    status: STAGES[Math.min(idx + 1, STAGES.length - 1)]
                  });
                  Router.render();
                }
              }),
              UI.button(claim.helpline ? 'Call insurer' : I18n.t('close'), {
                variant: 'outline',
                onclick: function () {
                  if (claim.helpline) Native.dial(claim.helpline);
                }
              })
            ])
          ]));
        }(res.claims[i]));
      }
    }
  };

  function openClaimSheet(prefill, view) {
    var hospitalRes = Native.call('hospitals', { city: '' });
    var hospitalOptions = [];
    if (hospitalRes.ok) {
      for (var i = 0; i < hospitalRes.hospitals.length; i++) {
        hospitalOptions.push({
          value: hospitalRes.hospitals[i].id,
          label: hospitalRes.hospitals[i].name
        });
      }
    }
    var insurerOptions = [];
    for (var j = 0; j < Store.state.insurers.length; j++) {
      insurerOptions.push({
        value: Store.state.insurers[j].id, label: Store.state.insurers[j].name
      });
    }

    var hospitalSelect = UI.select(hospitalOptions, prefill.hospitalId || '');
    var insurerSelect = UI.select(insurerOptions, prefill.insurerId || Store.insurerId());
    var routeSelect = UI.select([
      { value: 'cashless', label: 'Cashless (network hospital)' },
      { value: 'reimbursement', label: 'Reimbursement (pay and claim)' }
    ], prefill.route || 'cashless');
    var amountInput = UI.input({ type: 'tel', inputmode: 'numeric',
      placeholder: 'Estimated bill amount' });
    var notesInput = UI.el('textarea.input', { placeholder: 'Notes, claim number, TPA name' });

    var close = UI.sheet('Track a claim', [
      UI.field(I18n.t('hospital'), hospitalSelect),
      UI.field(I18n.t('insurer'), insurerSelect),
      UI.field('Route', routeSelect),
      UI.field('Amount', amountInput),
      UI.field('Notes', notesInput)
    ], [
      UI.button(I18n.t('cancel'), { variant: 'outline', onclick: function () { close(); } }),
      UI.button(I18n.t('save'), {
        onclick: function () {
          Native.call('save_claim', {
            hospitalId: hospitalSelect.value,
            insurerId: insurerSelect.value,
            plan: Store.profile().plan || '',
            route: routeSelect.value,
            status: 'started',
            amount: Number(amountInput.value) || 0,
            notes: String(notesInput.value).trim()
          });
          close();
          Router.render();
        }
      })
    ]);
  }
}());
