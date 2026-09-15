/* Cost estimate and partner-lab comparison. */
(function () {
  'use strict';
  var el = UI.el;

  /** Selection survives while the user stays in the Costs tab. */
  var picked = { tests: ['hba1c', 'fbs', 'lipid'], city: '', doctorId: '' };

  Screens.cost = {
    title: function () { return I18n.t('cost_estimate'); },
    subtitle: function () { return picked.city || Store.city() || 'All cities'; },
    tab: 'cost',
    render: function (params, view) {
      if (params.tests && params.tests.length) {
        picked.tests = cleanCodes(params.tests);
      }
      if (params.city !== undefined) picked.city = params.city || '';
      if (params.doctorId !== undefined) picked.doctorId = params.doctorId || '';
      if (!picked.city) picked.city = Store.city();
      renderCost(view);
    }
  };

  function cleanCodes(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i]).trim();
      if (c && out.indexOf(c) < 0) out.push(c);
    }
    return out;
  }

  function renderCost(view) {
    UI.clear(view);

    view.appendChild(el('div.banner.info', null, [
      el('span.banner-icon', { text: 'ℹ' }),
      el('span', { text: 'Indicative price bands for the pilot cities, so you know '
        + 'roughly what to carry before you leave home.' })
    ]));

    // City selector
    var cityRow = el('div.wrap', { style: 'margin-bottom:10px' });
    for (var i = 0; i < Store.state.cities.length; i++) {
      (function (city) {
        cityRow.appendChild(UI.chip(city, {
          active: picked.city === city,
          onclick: function () { picked.city = city; renderCost(view); }
        }));
      }(Store.state.cities[i]));
    }
    view.appendChild(cityRow);

    var est = Native.call('estimate', {
      city: picked.city, tests: picked.tests, doctorId: picked.doctorId
    });
    if (!est.ok) {
      view.appendChild(el('div.banner.danger', null, [est.error || 'Estimate failed']));
      return;
    }

    view.appendChild(el('div.total-card', null, [
      el('div.sub', { text: I18n.t('total_if_done_nearby') +
        (est.doctor ? ' · with ' + est.doctor.name : '') }),
      el('div.amount', { text: UI.band(est.totalMin, est.totalMax) }),
      el('div.sub', { text: (est.opdMax ? I18n.t('opd_fee') + ' ' +
        UI.band(est.opdMin, est.opdMax) + '  +  ' : '') + 'tests ' +
        UI.band(est.testsBestTotal, est.testsTypicalMax) })
    ]));

    if (est.savings > 0) {
      view.appendChild(el('div.banner.warn', null, [
        el('span.banner-icon', { text: '₹' }),
        el('span', { text: I18n.t('you_could_save') + ' ' + UI.rupees(est.savings) +
          ' on the same tests by choosing the cheapest partner lab in ' +
          (picked.city || 'your city') + '.' })
      ]));
    }

    // Doctor attached to the estimate (or a prompt to attach one)
    if (est.doctor) {
      view.appendChild(UI.card([
        UI.row([
          el('div.strong', { text: est.doctor.name }),
          el('div.small.muted', { text: est.doctor.specialty })
        ], [
          el('div.fee-label', { text: I18n.t('opd_fee') }),
          el('div.fee', { text: UI.band(est.opdMin, est.opdMax) }),
          el('button.block-link', {
            text: 'remove',
            onclick: function () { picked.doctorId = ''; renderCost(view); }
          })
        ])
      ]));
    } else {
      view.appendChild(UI.card([
        el('p.small.muted', { style: 'margin:0 0 8px',
          text: 'Add a doctor to include the OPD fee in this estimate.' }),
        UI.button(I18n.t('find_doctor'), {
          block: true, variant: 'ghost',
          onclick: function () { Router.tab('find'); }
        })
      ]));
    }

    // Test table
    var table = el('table.ctable');
    table.appendChild(el('thead', null, [el('tr', null, [
      el('th', { text: 'Test' }),
      el('th.num', { text: 'Usual band' }),
      el('th.num', { text: 'Best partner' })
    ])]));
    var tbody = el('tbody');
    for (var t = 0; t < est.tests.length; t++) {
      var row = est.tests[t];
      tbody.appendChild(el('tr', null, [
        el('td', null, [
          el('div', { text: row.name }),
          row.fasting && Number(row.fasting) === 1
            ? el('div.tiny.muted', { text: 'fasting needed' }) : null
        ]),
        el('td.num', { text: UI.band(row.typical_min, row.typical_max) }),
        el('td.num', null, [
          el('div.strong', { text: row.bestPrice ? UI.rupees(row.bestPrice) : '--' }),
          row.bestLab ? el('div.tiny.muted', { text: row.bestLab }) : null
        ])
      ]));
    }
    table.appendChild(tbody);

    view.appendChild(UI.section(I18n.t('select_tests'), UI.card([
      est.tests.length ? table : el('p.small.muted', { text: 'No tests selected yet.' }),
      UI.button(I18n.t('select_tests'), {
        block: true, variant: 'ghost', onclick: function () { openTestSheet(view); }
      })
    ])));

    // Quick packages straight from the condition rule table
    var packRow = el('div.wrap');
    for (var c = 0; c < Store.state.conditions.length; c++) {
      (function (cond) {
        packRow.appendChild(UI.chip(cond.label, {
          onclick: function () {
            picked.tests = cleanCodes(String(cond.tests).split(','));
            renderCost(view);
          }
        }));
      }(Store.state.conditions[c]));
    }
    view.appendChild(UI.section('Common test sets', UI.card([
      el('p.small.muted', { style: 'margin:0 0 8px',
        text: 'Pick the usual set for a condition, then compare labs.' }),
      packRow
    ])));

    // Labs, cheapest first
    var labs = (est.labs || []).slice();
    labs.sort(function (a, b) {
      if (!a.total) return 1;
      if (!b.total) return -1;
      return a.total - b.total;
    });
    var labList = el('div');
    if (!labs.length) {
      labList.appendChild(UI.empty('No partner lab listed for this city yet.'));
    }
    for (var l = 0; l < labs.length; l++) {
      labList.appendChild(Cards.lab(labs[l], { hideTests: l > 1 }));
    }
    view.appendChild(UI.section(I18n.t('cheapest_partner_lab'), labList));

    view.appendChild(UI.card([
      UI.button(I18n.t('share_app'), {
        block: true, variant: 'ghost',
        onclick: function () {
          var lines = ['Medical Navigator - estimate for ' + (picked.city || 'my city')];
          if (est.doctor) lines.push('Doctor: ' + est.doctor.name + ' (OPD ' +
            UI.band(est.opdMin, est.opdMax) + ')');
          for (var i = 0; i < est.tests.length; i++) {
            lines.push('- ' + est.tests[i].name + ': ' +
              (est.tests[i].bestPrice ? UI.rupees(est.tests[i].bestPrice)
                : UI.band(est.tests[i].typical_min, est.tests[i].typical_max)));
          }
          lines.push('Estimated total: ' + UI.band(est.totalMin, est.totalMax));
          lines.push('(Sample pilot data, not a quotation.)');
          Native.share(lines.join('\n'));
        }
      })
    ]));

    view.appendChild(el('p.tiny.muted.center', {
      text: 'Prices are indicative bands, not quotations. Confirm with the lab or hospital.'
    }));
  }

  function openTestSheet(view) {
    var chosen = picked.tests.slice();
    var list = el('div');
    for (var i = 0; i < Store.state.tests.length; i++) {
      (function (test) {
        var check = UI.input({ type: 'checkbox', checked: chosen.indexOf(test.code) >= 0 });
        check.addEventListener('change', function () {
          var idx = chosen.indexOf(test.code);
          if (check.checked && idx < 0) chosen.push(test.code);
          if (!check.checked && idx >= 0) chosen.splice(idx, 1);
        });
        list.appendChild(el('label.check', null, [
          check,
          el('span', null, [
            el('div', { text: test.name }),
            el('div.tiny.muted', { text: UI.band(test.typical_min, test.typical_max) +
              (Number(test.fasting) === 1 ? ' · fasting' : '') })
          ])
        ]));
      }(Store.state.tests[i]));
    }
    var close = UI.sheet(I18n.t('select_tests'), [list], [
      UI.button(I18n.t('cancel'), { variant: 'outline', onclick: function () { close(); } }),
      UI.button(I18n.t('apply'), {
        onclick: function () {
          picked.tests = chosen;
          close();
          renderCost(view);
        }
      })
    ]);
  }
}());
