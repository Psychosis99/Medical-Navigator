/*
 * The care team — the app's primary feature.
 *
 * Everything else in the app helps a patient decide something on their own.
 * This is the part where they can simply ask a person: our own consultant,
 * reachable before they have spent anything, who tells them which specialist
 * they actually need.
 */
(function () {
  'use strict';
  var el = UI.el;

  var ROLE_LABEL = {
    primary: 'Primary consultant',
    associate: 'Associate consultant',
    coordinator: 'Care coordinator',
    insurance: 'Insurance desk'
  };

  // ------------------------------------------------------------------
  // Consult hub
  // ------------------------------------------------------------------
  Screens.consult = {
    title: function () { return I18n.t('consult_title'); },
    subtitle: function () { return I18n.t('first_consult_free'); },
    tab: 'consult',
    render: function (params, view) {
      var res = Native.call('consult_team', {});
      if (!res.ok || !res.team.length) {
        view.appendChild(el('div.banner.danger', null, [res.error || 'Care team unavailable']));
        return;
      }

      var primary = res.team[0];
      for (var i = 0; i < res.team.length; i++) {
        if (res.team[i].role === 'primary') primary = res.team[i];
      }

      view.appendChild(el('div.consult-hero', null, [
        el('div.consult-hero-top', null, [
          el('div.avatar.lead', { text: UI.initials(primary.name) }),
          el('div.row-left', null, [
            el('div.consult-name', { text: primary.name }),
            el('div.consult-role', { text: primary.title }),
            el('div.consult-qual', { text: primary.qualification + ' · '
              + primary.exp_years + ' ' + I18n.t('years') })
          ])
        ]),
        el('p.consult-lead', { text: I18n.t('consult_lead') }),
        el('div.consult-status', null, [
          el('span.dot' + (primary.available ? ' on' : '')),
          el('span', { text: primary.available ? I18n.t('available_now') : I18n.t('away_now') }),
          el('span.consult-sla', { text: primary.sla })
        ]),
        UI.button(I18n.t('start_chat'), {
          block: true, variant: 'onbrand',
          onclick: function () { openRequest(primary, 'chat', ''); }
        }),
        el('div.btn-grid', { style: 'margin-top:8px' }, [
          UI.button(I18n.t('request_call'), {
            variant: 'onbrand-ghost',
            onclick: function () { openRequest(primary, 'call', ''); }
          }),
          UI.button(I18n.t('chat_whatsapp'), {
            variant: 'onbrand-ghost',
            onclick: function () { openRequest(primary, 'whatsapp', ''); }
          })
        ])
      ]));

      view.appendChild(el('div.banner.info', null, [
        el('span.banner-icon', { text: '₹' }),
        el('span', { text: primary.fee_note + ' ' + I18n.t('ask_anything') })
      ]));

      // Topics: the quickest way in is to name the question.
      var topicWrap = el('div.wrap');
      for (var t = 0; t < res.topics.length; t++) {
        (function (topic) {
          topicWrap.appendChild(UI.chip(topic.label, {
            onclick: function () {
              var target = primary;
              for (var k = 0; k < res.team.length; k++) {
                if (res.team[k].role === topic.role) target = res.team[k];
              }
              openRequest(target, 'chat', topic.label, topic.hint);
            }
          }));
        }(res.topics[t]));
      }
      view.appendChild(UI.section(I18n.t('what_is_it_about'), UI.card([
        el('p.small.muted', { style: 'margin:0 0 8px',
          text: 'Pick a topic so the consultant has context before you start.' }),
        topicWrap
      ])));

      // Open conversations first: they are the reason to come back.
      if (res.requests && res.requests.length) {
        var threads = el('div');
        for (var r = 0; r < res.requests.length && r < 3; r++) {
          threads.appendChild(requestCard(res.requests[r]));
        }
        view.appendChild(UI.section(I18n.t('my_consults'), threads,
          res.requests.length > 3 ? el('button.block-link', {
            text: 'See all',
            onclick: function () { Router.go('consult_history', {}); }
          }) : null));
      }

      var team = el('div');
      var others = 0;
      for (var m = 0; m < res.team.length; m++) {
        if (res.team[m].id === primary.id) continue;
        team.appendChild(teamCard(res.team[m]));
        others++;
      }
      if (others) view.appendChild(UI.section(I18n.t('care_team'), team));

      view.appendChild(UI.section(I18n.t('helps_with'), UI.card([
        el('button.block-link', {
          style: 'float:right',
          text: 'Full profile \u203A',
          onclick: function () { Router.go('consultant', { id: primary.id }); }
        }),
        (function () {
          var ul = el('ul.checklist');
          for (var h = 0; h < primary.helpsWithList.length; h++) {
            ul.appendChild(el('li', null, [el('span', { text: primary.helpsWithList[h] })]));
          }
          return ul;
        }())
      ])));

      view.appendChild(el('div.banner.warn', null, [
        el('span.banner-icon', { text: '⚠' }),
        el('span', { text: 'Demo build: the care team is a sample profile and replies '
          + 'come from a fixed rule table, not a live clinician. For anything urgent '
          + 'use Emergency.' })
      ]));
    }
  };

  function teamCard(c) {
    return UI.card([
      el('div.doc', null, [
        el('div.avatar' + (c.role === 'insurance' || c.role === 'coordinator'
          ? '.hosp' : ''), { text: UI.initials(c.name) }),
        el('div.row-left', null, [
          el('div.doc-name', { text: c.name }),
          el('div.doc-meta', { text: c.title }),
          el('div.small', { style: 'margin-top:3px' }, [
            UI.stars(c.rating),
            el('span.muted', { text: ' ' + Number(c.rating).toFixed(1) })
          ])
        ]),
        el('div.row-right', null, [
          UI.badge(c.available ? I18n.t('available_now') : I18n.t('away_now'),
            c.available ? 'good' : 'flat')
        ])
      ]),
      el('div.small.muted', { style: 'margin-top:6px', text: c.hours })
    ], {
      tappable: true,
      onclick: function () { Router.go('consultant', { id: c.id }); }
    });
  }

  function requestCard(r) {
    var tone = r.status === 'closed' ? 'flat' : (r.status === 'open' ? 'good' : 'warn');
    return UI.card([
      UI.row(
        [el('div.strong', { text: r.consultant_name || 'Care team' }),
         el('div.small.muted', { text: (r.topic || I18n.t('ask_anything')) }),
         el('div.tiny.muted', { text: r.channelLabel + ' · ' + UI.timeAgo(r.created_ts) })],
        [UI.badge(r.status, tone)]
      ),
      UI.button(I18n.t('open_thread') +
        (r.messageCount ? ' (' + r.messageCount + ')' : ''), {
        block: true, variant: 'ghost',
        onclick: function () {
          Router.go('chat', { bookingId: r.id, title: r.consultant_name });
        }
      })
    ]);
  }

  // ------------------------------------------------------------------
  // Consultant profile
  // ------------------------------------------------------------------
  Screens.consultant = {
    title: function () { return I18n.t('primary_consultant'); },
    tab: null,
    render: function (params, view) {
      var res = Native.call('consult_team', {});
      var c = null;
      for (var i = 0; res.ok && i < res.team.length; i++) {
        if (res.team[i].id === params.id) c = res.team[i];
      }
      if (!c) {
        view.appendChild(UI.empty('Consultant not found.'));
        return;
      }

      view.appendChild(UI.card([
        el('div.doc', null, [
          el('div.avatar.lead', { text: UI.initials(c.name) }),
          el('div.row-left', null, [
            el('div.doc-name', { style: 'font-size:17px', text: c.name }),
            el('div.doc-meta', { text: c.title }),
            el('div.doc-meta', { text: c.qualification }),
            el('div.small', { style: 'margin-top:4px' }, [
              UI.stars(c.rating),
              el('span.muted', { text: ' ' + Number(c.rating).toFixed(1) +
                ' (' + c.rating_count + ')' })
            ])
          ])
        ]),
        el('div.wrap', { style: 'margin-top:8px' }, [
          UI.badge(ROLE_LABEL[c.role] || c.role, ''),
          UI.badge(c.available ? I18n.t('available_now') : I18n.t('away_now'),
            c.available ? 'good' : 'flat'),
          c.sample ? UI.badge(I18n.t('sample_data'), 'warn') : null
        ]),
        el('p.small', { style: 'margin-top:10px', text: c.bio })
      ]));

      view.appendChild(UI.card([
        el('div.kv', null, [el('span.k', { text: I18n.t('working_hours') }),
          el('span.v', { text: c.hours })]),
        el('div.kv', null, [el('span.k', { text: I18n.t('response_time') }),
          el('span.v', { text: c.sla })]),
        el('div.kv', null, [el('span.k', { text: I18n.t('languages') }),
          el('span.v', { text: c.languageList.join(', ') })]),
        el('div.kv', null, [el('span.k', { text: 'Fees' }),
          el('span.v', { text: c.fee_note })]),
        el('div.kv', null, [el('span.k', { text: I18n.t('experience') }),
          el('span.v', { text: c.exp_years + ' ' + I18n.t('years') })])
      ]));

      var ul = el('ul.checklist');
      for (var h = 0; h < c.helpsWithList.length; h++) {
        ul.appendChild(el('li', null, [el('span', { text: c.helpsWithList[h] })]));
      }
      view.appendChild(UI.section(I18n.t('helps_with'), UI.card([
        el('button.block-link', {
          style: 'float:right',
          text: 'Full profile \u203A',
          onclick: function () { Router.go('consultant', { id: primary.id }); }
        }),ul])));

      view.appendChild(UI.button(I18n.t('start_chat'), {
        block: true,
        onclick: function () { openRequest(c, 'chat', ''); }
      }));
      view.appendChild(el('div.btn-grid', { style: 'margin-top:8px' }, [
        UI.button(I18n.t('request_call'), {
          variant: 'ghost',
          onclick: function () { openRequest(c, 'call', ''); }
        }),
        UI.button(I18n.t('book_video'), {
          variant: 'ghost',
          onclick: function () { openRequest(c, 'video', ''); }
        })
      ]));
    }
  };

  // ------------------------------------------------------------------
  // All past consultations
  // ------------------------------------------------------------------
  Screens.consult_history = {
    title: function () { return I18n.t('my_consults'); },
    tab: null,
    render: function (params, view) {
      var res = Native.call('consult_requests', {});
      if (!res.ok || !res.requests.length) {
        view.appendChild(UI.empty(I18n.t('no_consults'), '⚕'));
        view.appendChild(UI.button(I18n.t('start_chat'), {
          block: true, onclick: function () { Router.tab('consult'); }
        }));
        return;
      }
      for (var i = 0; i < res.requests.length; i++) {
        view.appendChild(requestCard(res.requests[i]));
      }
    }
  };

  // ------------------------------------------------------------------
  // Request sheet
  // ------------------------------------------------------------------

  /**
   * One sheet for every channel. Chat drops straight into a thread; the other
   * channels queue a callback, which this build records rather than dialling -
   * there is no telephony behind it and we will not pretend otherwise.
   */
  function openRequest(consultant, channel, topic, hint) {
    var noteInput = UI.el('textarea.input', {
      placeholder: hint || I18n.t('describe_briefly')
    });
    var timeSelect = UI.select([
      { value: 'As soon as possible', label: 'As soon as possible' },
      { value: 'This morning', label: 'This morning' },
      { value: 'This afternoon', label: 'This afternoon' },
      { value: 'This evening', label: 'This evening' },
      { value: 'Tomorrow', label: 'Tomorrow' }
    ], 'As soon as possible');

    var body = [
      el('div.spread', { style: 'margin-bottom:10px' }, [
        el('div', null, [
          el('div.strong', { text: consultant.name }),
          el('div.tiny.muted', { text: consultant.title })
        ]),
        UI.badge(consultant.available ? I18n.t('available_now') : I18n.t('away_now'),
          consultant.available ? 'good' : 'flat')
      ])
    ];
    if (topic) body.push(el('div.banner.info', null, [
      el('span.banner-icon', { text: 'ℹ' }),
      el('span', { text: topic })
    ]));
    body.push(UI.field(I18n.t('describe_briefly'), noteInput));
    if (channel !== 'chat') body.push(UI.field(I18n.t('preferred_time'), timeSelect));
    body.push(el('p.tiny.muted', { text: consultant.sla + ' · ' + consultant.hours }));

    var close = UI.sheet(channelTitle(channel), body, [
      UI.button(I18n.t('cancel'), { variant: 'outline', onclick: function () { close(); } }),
      UI.button(channel === 'chat' ? I18n.t('start_chat') : I18n.t('send_request'), {
        onclick: function () {
          var note = String(noteInput.value).trim();
          var res = Native.call('consult_request', {
            consultantId: consultant.id,
            channel: channel,
            topic: topic || '',
            note: note,
            preferredTime: channel === 'chat' ? '' : timeSelect.value
          });
          if (!res.ok) {
            UI.snack(res.error || 'Could not send the request');
            return;
          }
          close();
          Native.tap(20);

          if (channel === 'chat') {
            Router.go('chat', { bookingId: res.requestId, title: consultant.name });
            return;
          }
          if (channel === 'whatsapp') {
            Native.share('Medical Navigator - consult request for '
              + consultant.name + '\nTopic: ' + (topic || 'general')
              + (note ? '\nDetails: ' + note : '')
              + '\nPreferred time: ' + timeSelect.value);
          }
          confirmSheet(consultant, channel, timeSelect.value);
        }
      })
    ]);
  }

  function channelTitle(channel) {
    if (channel === 'call') return I18n.t('request_call');
    if (channel === 'whatsapp') return I18n.t('chat_whatsapp');
    if (channel === 'video') return I18n.t('book_video');
    return I18n.t('start_chat');
  }

  function confirmSheet(consultant, channel, when) {
    var phone = Store.profile().phone;
    var close = UI.sheet(I18n.t('request_sent'), [
      el('div.banner.info', null, [
        el('span.banner-icon', { text: '✓' }),
        el('span', { text: consultant.name + ' will reach you'
          + (phone ? ' on +91 ' + phone : '') + ' — ' + when.toLowerCase() + '.' })
      ]),
      el('p.small.muted', { text: consultant.sla + ' Working hours: ' + consultant.hours + '.' }),
      el('div.banner.warn', null, [
        el('span.banner-icon', { text: '⚠' }),
        el('span', { text: 'Demo build: no call is actually placed. The request is '
          + 'recorded in My consultations so the flow can be reviewed end to end.' })
      ])
    ], [
      UI.button(I18n.t('done'), {
        onclick: function () { close(); Router.render(); }
      })
    ]);
  }
}());
