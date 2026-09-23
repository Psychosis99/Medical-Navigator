/*
 * The welcome guide shown once, right after sign-up, and re-openable any time
 * from Me. A patient who does not understand what a health app is for will not
 * trust it with a health question, so this explains the app in six short cards
 * before asking anything else of them.
 */
(function () {
  'use strict';
  var el = UI.el;

  var PAGES = [
    { icon: '✚', key: 'guide_1' },
    { icon: '⚕', key: 'guide_2', primary: true },
    { icon: '⌕', key: 'guide_3' },
    { icon: '₹', key: 'guide_4' },
    { icon: '⛨', key: 'guide_5' },
    { icon: '⚿', key: 'guide_6' }
  ];

  Screens.guide = {
    title: function () { return I18n.t('guide_title'); },
    tab: null,
    action: function (params) {
      // "Skip" only makes sense on the first run; afterwards the back arrow does.
      if (!params.firstRun) return null;
      return el('button.lang-btn', {
        text: I18n.t('guide_skip'),
        onclick: function () { finish(params); }
      });
    },
    render: function (params, view) {
      var page = Number(params.page || 0);
      if (page < 0) page = 0;
      if (page > PAGES.length - 1) page = PAGES.length - 1;
      var spec = PAGES[page];

      var dots = el('div.progress');
      for (var i = 0; i < PAGES.length; i++) {
        dots.appendChild(el('span' + (i <= page ? '.on' : '')));
      }
      view.appendChild(dots);

      view.appendChild(el('div.guide-card' + (spec.primary ? ' primary' : ''), null, [
        page === 0
          ? el('img.brand-mark.lead.on-card', { src: 'img/logo.jpg', alt: '' })
          : el('div.guide-icon', { text: spec.icon }),
        el('h1.guide-title', { text: I18n.t(spec.key + '_title') }),
        el('p.guide-body', { text: I18n.t(spec.key + '_body') }),
        spec.primary
          ? el('div.guide-flag', { text: I18n.t('first_consult_free') })
          : null
      ]));

      view.appendChild(el('p.tiny.muted.center', {
        text: (page + 1) + ' / ' + PAGES.length
      }));

      var isLast = page === PAGES.length - 1;
      view.appendChild(UI.button(isLast ? I18n.t('guide_finish') : I18n.t('next'), {
        block: true,
        onclick: function () {
          if (isLast) {
            finish(params);
            return;
          }
          Router.go('guide', { page: page + 1, firstRun: params.firstRun },
            { replace: true });
        }
      }));

      if (page > 0) {
        view.appendChild(el('div', { style: 'height:8px' }));
        view.appendChild(UI.button(I18n.t('back'), {
          block: true, variant: 'outline',
          onclick: function () {
            Router.go('guide', { page: page - 1, firstRun: params.firstRun },
              { replace: true });
          }
        }));
      }

      if (page === 0) {
        view.appendChild(el('p.tiny.muted.center', {
          style: 'margin-top:14px',
          text: I18n.t('company_line') + ' · ' + I18n.t('not_medical_advice')
        }));
      }
    }
  };

  function finish(params) {
    Native.track('guide_finished', 'firstRun=' + (params.firstRun ? '1' : '0'));
    if (params.firstRun) {
      Store.saveProfile({ guide_seen: '1' });
      // Land on the care team: the guide has just said to start there.
      Router.tab('consult');
    } else {
      Router.back();
    }
  }
}());
