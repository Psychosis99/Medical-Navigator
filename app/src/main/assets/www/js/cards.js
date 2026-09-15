/** Shared list-item renderers, so a doctor looks identical everywhere. */
var Cards = (function () {
  'use strict';
  var el = UI.el;

  function doctor(d, opts) {
    opts = opts || {};
    var badges = el('div.wrap', { style: 'margin-top:6px' });
    if (d.cashlessForYou) badges.appendChild(UI.badge(I18n.t('cashless_possible'), 'good'));
    if (Number(d.govt_scheme) === 1) badges.appendChild(UI.badge(I18n.t('govt_scheme'), 'flat'));
    if (d.teleAvailable) badges.appendChild(UI.badge(I18n.t('teleconsult'), ''));
    if (d.sample) badges.appendChild(UI.badge(I18n.t('sample_data'), 'warn'));

    return UI.card([
      el('div.doc', null, [
        el('div.avatar', { text: UI.initials(d.name) }),
        el('div.row-left', null, [
          el('div.doc-name', { text: d.name }),
          el('div.doc-meta', { text: d.specialty + ' · ' + d.exp_years + ' ' + I18n.t('years') }),
          el('div.doc-meta', { text: (d.hospital_name || '') +
            (d.area ? ' · ' + d.area : '') }),
          el('div.small', { style: 'margin-top:3px' }, [
            UI.stars(d.rating),
            el('span.muted', { text: ' ' + Number(d.rating).toFixed(1) +
              ' (' + d.rating_count + ')' }),
            d.distance_km ? el('span.muted', { text: ' · ' + d.distance_km + ' km' }) : null
          ])
        ]),
        el('div.row-right', null, [
          el('div.fee-label', { text: I18n.t('opd_fee') }),
          el('div.fee', { text: d.feeBand }),
          d.teleAvailable
            ? el('div.tiny.muted', { text: I18n.t('teleconsult') + ' ' + UI.rupees(d.tele_fee) })
            : null
        ])
      ]),
      badges,
      opts.hideCta ? null : el('div.btn-grid', { style: 'margin-top:10px' }, [
        UI.button(I18n.t('book_teleconsult'), {
          variant: d.teleAvailable ? 'ghost' : 'outline',
          disabled: !d.teleAvailable,
          onclick: function () {
            Router.go('booking', { doctorId: d.id, kind: 'tele' });
          }
        }),
        UI.button('Details', {
          onclick: function () {
            Native.track('doctor_view', d.id);
            Router.go('doctor', { id: d.id });
          }
        })
      ])
    ], {
      tappable: true,
      onclick: opts.hideCta ? function () {
        Native.track('doctor_view', d.id);
        Router.go('doctor', { id: d.id });
      } : null
    });
  }

  function hospital(h, opts) {
    opts = opts || {};
    var tags = el('div.wrap', { style: 'margin-top:6px' });
    tags.appendChild(UI.badge(h.type === 'govt' ? 'Government'
      : (h.type === 'trust' ? 'Trust run' : 'Private'), 'flat'));
    if (Number(h.emergency) === 1) tags.appendChild(UI.badge('24x7 emergency', 'bad'));
    if (Number(h.abdm) === 1) tags.appendChild(UI.badge('ABDM linked', ''));
    if (h.cashlessForYou) tags.appendChild(UI.badge(I18n.t('network_hospital'), 'good'));
    if (h.sample) tags.appendChild(UI.badge(I18n.t('sample_data'), 'warn'));

    return UI.card([
      el('div.doc', null, [
        el('div.avatar.hosp', { text: UI.initials(h.name) }),
        el('div.row-left', null, [
          el('div.doc-name', { text: h.name }),
          el('div.doc-meta', { text: (h.area ? h.area + ' · ' : '') + h.city +
            ' · ' + h.distance_km + ' km' }),
          el('div.small', { style: 'margin-top:3px' }, [
            UI.stars(h.rating),
            el('span.muted', { text: ' ' + Number(h.rating).toFixed(1) +
              ' · ' + h.beds + ' beds' })
          ])
        ])
      ]),
      tags,
      h.address ? el('div.small.muted', { style: 'margin-top:6px', text: h.address }) : null,
      opts.hideCoverage
        ? UI.button(I18n.t('call_now'), {
            block: true, variant: 'ghost',
            onclick: function () { Native.dial(h.phone); }
          })
        : el('div.btn-grid', { style: 'margin-top:10px' }, [
            UI.button(I18n.t('call_now'), {
              variant: 'ghost',
              onclick: function () { Native.dial(h.phone); }
            }),
            UI.button(I18n.t('check_coverage'), {
              onclick: function () {
                Router.go('insurance_check', { hospitalId: h.id });
              }
            })
          ])
    ]);
  }

  function booking(b) {
    var tone = b.status === 'completed' ? 'good'
      : (b.status === 'cancelled' ? 'bad' : '');
    return UI.card([
      UI.row(
        [el('div.strong', { text: b.doctor_name || 'Doctor' }),
         el('div.small.muted', { text: (b.specialty || '') + ' · ' +
           (b.kind === 'tele' ? I18n.t('teleconsult') : 'OPD') +
           (b.slot ? ' · ' + b.slot : '') }),
         el('div.tiny.muted', { text: b.hospital_name || '' })],
        [UI.badge(b.status, tone),
         el('div.small.strong', { style: 'margin-top:4px', text: UI.rupees(b.fee) })]
      ),
      el('div.btn-grid', { style: 'margin-top:10px' }, [
        b.kind === 'tele'
          ? UI.button(I18n.t('chat_with_doctor') + (b.messageCount
              ? ' (' + b.messageCount + ')' : ''), {
              variant: 'ghost',
              onclick: function () { Router.go('chat', { bookingId: b.id }); }
            })
          : UI.button(I18n.t('directions'), {
              variant: 'ghost',
              onclick: function () {
                UI.sheet(b.hospital_name || I18n.t('hospital'), [
                  el('p', { text: b.address || 'Address not listed' }),
                  UI.button(I18n.t('call_now'), {
                    block: true,
                    onclick: function () { Native.dial(b.hospital_phone); }
                  })
                ]);
              }
            }),
        Number(b.rated) === 1
          ? UI.button('Rated', { variant: 'outline', disabled: true })
          : UI.button(I18n.t('rate_visit'), {
              onclick: function () { Router.go('rate', { bookingId: b.id }); }
            })
      ]),
      b.status === 'confirmed' ? el('div.small', { style: 'margin-top:8px' }, [
        el('button.block-link', {
          text: 'Mark as completed',
          onclick: function () {
            Native.call('update_booking', { id: b.id, status: 'completed' });
            UI.snack('Marked completed. Please rate the visit.');
            Router.go('rate', { bookingId: b.id });
          }
        }),
        el('span.muted', { text: ' · ' }),
        el('button.block-link', {
          text: I18n.t('cancel'),
          onclick: function () {
            UI.confirmSheet(I18n.t('cancel'), 'Cancel this booking?', function () {
              Native.call('update_booking', { id: b.id, status: 'cancelled' });
              Router.render();
            }, I18n.t('cancel'));
          }
        })
      ]) : null
    ]);
  }

  function lab(l, opts) {
    opts = opts || {};
    var rows = el('div');
    for (var i = 0; i < (l.tests || []).length; i++) {
      var t = l.tests[i];
      rows.appendChild(el('div.kv', null, [
        el('span.k', { text: t.name }),
        el('span.v', { text: t.price === null ? 'not offered' : UI.rupees(t.price) })
      ]));
    }
    return UI.card([
      UI.row(
        [el('div.strong', { text: l.name }),
         el('div.small.muted', { text: l.city +
           (Number(l.nabl) === 1 ? ' · NABL listed' : '') +
           (Number(l.home_collection) === 1 ? ' · home collection' : '') }),
         el('div.small', null, [UI.stars(l.rating),
           el('span.muted', { text: ' ' + Number(l.rating).toFixed(1) })])],
        [el('div.fee-label', { text: 'Partner rate' }),
         el('div.fee', { text: l.total ? UI.rupees(l.total) : '--' }),
         el('div.tiny.muted', { text: l.discount + '% network discount' })]
      ),
      opts.hideTests ? null : rows,
      l.missing ? el('div.tiny.muted', {
        text: l.missing + ' of the selected tests are not offered here.'
      }) : null,
      UI.button(I18n.t('call_now'), {
        variant: 'ghost', block: true,
        onclick: function () { Native.dial(l.phone); }
      })
    ]);
  }

  var CLAUSE_TONE = {
    covered: 'good', limit: 'warn', waiting: 'warn',
    excluded: 'bad', process: 'flat'
  };

  function clause(c) {
    var label = {
      covered: I18n.t('covered'), waiting: I18n.t('waiting'),
      excluded: I18n.t('excluded'), limit: I18n.t('limits'),
      process: I18n.t('process')
    }[c.kind] || c.kind;
    return UI.card([
      el('div.spread', null, [
        el('div.strong', { text: c.heading }),
        UI.badge(label, CLAUSE_TONE[c.kind] || 'flat')
      ]),
      el('p.small.muted', { style: 'margin:6px 0 0', text: c.body })
    ]);
  }

  return {
    doctor: doctor, hospital: hospital, booking: booking,
    lab: lab, clause: clause
  };
}());
