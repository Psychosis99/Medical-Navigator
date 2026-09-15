/**
 * Tiny DOM toolkit. No framework: the whole UI is built from these helpers so
 * the APK stays small and starts fast on the entry-level Android phones that
 * dominate the target market.
 */
var UI = (function () {
  'use strict';

  /** el('div.card', {onclick: fn}, [children]) */
  function el(spec, attrs, children) {
    var parts = String(spec).split('.');
    var tag = parts.shift() || 'div';
    var node = document.createElement(tag);
    if (parts.length) node.className = parts.join(' ');

    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === 'text') node.textContent = String(v);
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2), v);
        } else if (k === 'value') node.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected') {
          if (v) node.setAttribute(k, k);
          node[k] = !!v;
        } else node.setAttribute(k, String(v));
      }
    }

    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) return node;
    if (!Array.isArray(children)) children = [children];
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /** Rupee formatting with Indian digit grouping. */
  function rupees(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    var s = String(Math.round(Number(n)));
    if (s.length <= 3) return '₹' + s;
    var last3 = s.slice(-3);
    var rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return '₹' + rest + ',' + last3;
  }

  function band(min, max) {
    if (!min && !max) return '--';
    if (!max || min === max) return rupees(min);
    return rupees(min) + ' – ' + rupees(max);
  }

  /** Star row; interactive when onPick is supplied. */
  function stars(value, onPick) {
    var wrap = el('span.stars', { 'aria-label': value + ' out of 5' });
    for (var i = 1; i <= 5; i++) {
      var filled = Number(value) >= i - 0.25;
      var half = !filled && Number(value) >= i - 0.75;
      var star = el('span.star' + (filled ? ' on' : (half ? ' half' : '')),
        { text: '★' });
      if (onPick) {
        star.className += ' tappable';
        (function (n) {
          star.addEventListener('click', function () { onPick(n); });
        }(i));
      }
      wrap.appendChild(star);
    }
    return wrap;
  }

  function chip(label, opts) {
    opts = opts || {};
    return el('button.chip' + (opts.active ? ' active' : ''), {
      type: 'button', text: label, onclick: opts.onclick
    });
  }

  function badge(label, tone) {
    return el('span.badge' + (tone ? ' ' + tone : ''), { text: label });
  }

  function card(children, opts) {
    opts = opts || {};
    return el('div.card' + (opts.tappable ? ' tappable' : '') +
      (opts.cls ? ' ' + opts.cls : ''), { onclick: opts.onclick }, children);
  }

  function row(left, right, cls) {
    return el('div.row' + (cls ? ' ' + cls : ''), null, [
      el('div.row-left', null, left),
      right ? el('div.row-right', null, right) : null
    ]);
  }

  function section(title, children, action) {
    return el('section.block', null, [
      title ? el('div.block-head', null, [
        el('h2.block-title', { text: title }),
        action || null
      ]) : null,
      children
    ]);
  }

  function field(label, control, hint) {
    return el('label.field', null, [
      el('span.field-label', { text: label }),
      control,
      hint ? el('span.field-hint', { text: hint }) : null
    ]);
  }

  function input(attrs) {
    return el('input.input', attrs);
  }

  function select(options, value, onchange, attrs) {
    var s = el('select.input', attrs || {});
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      var label = (typeof o === 'object') ? o.label : o;
      var val = (typeof o === 'object') ? o.value : o;
      s.appendChild(el('option', {
        value: val, text: label, selected: String(val) === String(value)
      }));
    }
    if (onchange) s.addEventListener('change', function () { onchange(s.value); });
    return s;
  }

  function button(label, opts) {
    opts = opts || {};
    return el('button.btn' + (opts.variant ? ' ' + opts.variant : '') +
      (opts.block ? ' block' : ''), {
      type: 'button', text: label, onclick: opts.onclick, disabled: opts.disabled
    });
  }

  function empty(message, icon) {
    return el('div.empty', null, [
      el('div.empty-icon', { text: icon || '○' }),
      el('p', { text: message })
    ]);
  }

  /** Bottom sheet; returns a close function. */
  function sheet(title, content, actions) {
    var scrim = el('div.scrim');
    var panel = el('div.sheet', null, [
      el('div.sheet-grip'),
      el('h3.sheet-title', { text: title }),
      el('div.sheet-body', null, content),
      actions ? el('div.sheet-actions', null, actions) : null
    ]);
    function close() {
      scrim.className = 'scrim closing';
      window.setTimeout(function () {
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      }, 180);
      Router.setSheetCloser(null);
    }
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) close();
    });
    scrim.appendChild(panel);
    document.body.appendChild(scrim);
    Router.setSheetCloser(close);
    return close;
  }

  /** In-app snack message (native toast is used for device-level feedback). */
  function snack(message) {
    var existing = document.querySelector('.snack');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var node = el('div.snack', { text: message });
    document.body.appendChild(node);
    window.setTimeout(function () {
      node.className = 'snack out';
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, 2200);
  }

  function confirmSheet(title, message, onYes, yesLabel) {
    var close = sheet(title, [el('p.muted', { text: message })], [
      button(I18n.t('cancel'), { variant: 'ghost', onclick: function () { close(); } }),
      button(yesLabel || I18n.t('done'), {
        variant: 'danger',
        onclick: function () { close(); onYes(); }
      })
    ]);
  }

  function timeAgo(ts) {
    var diff = Date.now() - Number(ts);
    if (isNaN(diff)) return '';
    var mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    var days = Math.round(hrs / 24);
    if (days < 30) return days + ' d ago';
    return new Date(Number(ts)).toLocaleDateString();
  }

  function clock(ts) {
    var d = new Date(Number(ts));
    var h = d.getHours();
    var m = d.getMinutes();
    var suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
  }

  function initials(name) {
    var parts = String(name || '').replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    var out = '';
    for (var i = 0; i < parts.length && out.length < 2; i++) {
      if (parts[i].length) out += parts[i].charAt(0).toUpperCase();
    }
    return out || '?';
  }

  return {
    el: el, append: append, clear: clear, rupees: rupees, band: band,
    stars: stars, chip: chip, badge: badge, card: card, row: row,
    section: section, field: field, input: input, select: select,
    button: button, empty: empty, sheet: sheet, snack: snack,
    confirmSheet: confirmSheet, timeAgo: timeAgo, clock: clock, initials: initials
  };
}());
