/**
 * Test double for the Android JS bridge, injected before the app's own scripts.
 *
 * It mirrors Repo.java's operations and response shapes over the real seed data
 * (window.__MEDNAV_SEED, extracted from SeedData.java) so the UI can be driven
 * in a desktop browser. It is a test double, not a second implementation: only
 * response shape and the filters the UI depends on are reproduced.
 */
(function () {
  'use strict';
  var seed = window.__MEDNAV_SEED;
  var db = {
    profile: {},
    bookings: [],
    messages: [],
    ratings: [],
    records: [],
    claims: [],
    events: [],
    consultRequests: []
  };
  window.__MEDNAV_CALLS = [];

  function csvHas(csv, value) {
    if (!csv || !value) return false;
    return (',' + String(csv).replace(/ /g, '') + ',').indexOf(',' + value + ',') >= 0;
  }

  function hospital(id) {
    for (var i = 0; i < seed.HOSPITALS.length; i++) {
      if (seed.HOSPITALS[i].id === id) return seed.HOSPITALS[i];
    }
    return null;
  }

  function doctor(id) {
    for (var i = 0; i < seed.DOCTORS.length; i++) {
      if (seed.DOCTORS[i].id === id) return seed.DOCTORS[i];
    }
    return null;
  }

  function test(code) {
    for (var i = 0; i < seed.TESTS.length; i++) {
      if (seed.TESTS[i].code === code) return seed.TESTS[i];
    }
    return { code: code, name: code, typical_min: 0, typical_max: 0 };
  }

  function decorate(d, insurerId) {
    var h = hospital(d.hospital_id) || {};
    var out = {};
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
    out.hospital_name = h.name;
    out.hospital_city = h.city;
    out.hospital_phone = h.phone;
    out.hospital_type = h.type;
    out.hospital_rating = h.rating;
    out.area = h.area;
    out.address = h.address;
    out.beds = h.beds;
    out.abdm = h.abdm;
    out.emergency = h.emergency;
    out.distance_km = h.distance_km;
    out.cashless = h.cashless;
    out.feeBand = d.opd_fee_min === d.opd_fee_max
      ? '₹' + d.opd_fee_min
      : '₹' + d.opd_fee_min + '-' + d.opd_fee_max;
    out.teleAvailable = d.tele_fee > 0;
    var both = insurerId && csvHas(d.insurers, insurerId) && csvHas(h.cashless, insurerId);
    out.cashlessForYou = !!both;
    out.insuranceNote = !insurerId
      ? 'Add your insurance in Profile to see cashless options'
      : (both ? 'Cashless possible with pre-authorisation'
              : 'Likely reimbursement only - confirm at the hospital desk');
    out.sample = true;
    return out;
  }

  function testDetails(codes, city) {
    var out = [];
    for (var i = 0; i < (codes || []).length; i++) {
      var code = String(codes[i]).trim();
      if (!code) continue;
      var t = test(code);
      var row = {
        code: t.code, name: t.name, typical_min: t.typical_min,
        typical_max: t.typical_max, fasting: t.fasting, note: t.note
      };
      var best = null;
      for (var j = 0; j < seed.LAB_TESTS.length; j++) {
        var lt = seed.LAB_TESTS[j];
        if (lt.test_code !== code) continue;
        var lab = null;
        for (var l = 0; l < seed.LABS.length; l++) {
          if (seed.LABS[l].id === lt.lab_id) lab = seed.LABS[l];
        }
        if (!lab) continue;
        if (city && lab.city !== city) continue;
        if (!best || lt.price < best.price) best = { price: lt.price, name: lab.name };
      }
      if (best) { row.bestPrice = best.price; row.bestLab = best.name; }
      out.push(row);
    }
    return out;
  }

  function labsFor(city, codes) {
    var out = [];
    for (var i = 0; i < seed.LABS.length; i++) {
      var lab = seed.LABS[i];
      if (city && lab.city !== city) continue;
      var copy = { id: lab.id, name: lab.name, city: lab.city, discount: lab.discount,
        home_collection: lab.home_collection, rating: lab.rating, phone: lab.phone,
        nabl: lab.nabl, tests: [], total: 0, missing: 0, sample: true };
      for (var t = 0; t < (codes || []).length; t++) {
        var code = String(codes[t]).trim();
        var price = null;
        for (var j = 0; j < seed.LAB_TESTS.length; j++) {
          if (seed.LAB_TESTS[j].lab_id === lab.id && seed.LAB_TESTS[j].test_code === code) {
            price = seed.LAB_TESTS[j].price;
          }
        }
        copy.tests.push({ code: code, name: test(code).name, price: price });
        if (price === null) copy.missing++; else copy.total += price;
      }
      out.push(copy);
    }
    return out;
  }

  function hospitalsFor(a) {
    var out = [];
    for (var i = 0; i < seed.HOSPITALS.length; i++) {
      var h = seed.HOSPITALS[i];
      if (a.city && h.city !== a.city) continue;
      if (a.insurerId && !csvHas(h.cashless, a.insurerId)) continue;
      if (a.emergencyOnly && h.emergency !== 1) continue;
      var copy = {};
      for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) copy[k] = h[k];
      copy.cashlessForYou = !!(a.insurerId && csvHas(h.cashless, a.insurerId));
      copy.insurerNames = [];
      copy.doctorCount = 0;
      copy.sample = true;
      for (var d = 0; d < seed.DOCTORS.length; d++) {
        if (seed.DOCTORS[d].hospital_id === h.id) copy.doctorCount++;
      }
      out.push(copy);
    }
    out.sort(function (x, y) { return x.distance_km - y.distance_km; });
    return out;
  }

  function bookingsList() {
    var out = [];
    for (var i = db.bookings.length - 1; i >= 0; i--) {
      var b = db.bookings[i];
      var d = doctor(b.doctor_id) || {};
      var h = hospital(d.hospital_id) || {};
      var count = 0;
      for (var m = 0; m < db.messages.length; m++) {
        if (db.messages[m].booking_id === b.id) count++;
      }
      out.push({
        id: b.id, doctor_id: b.doctor_id, kind: b.kind, slot: b.slot,
        status: b.status, fee: b.fee, created_ts: b.created_ts, reason: b.reason,
        rated: b.rated, doctor_name: d.name, specialty: d.specialty,
        tele_fee: d.tele_fee, hospital_name: h.name, address: h.address,
        hospital_phone: h.phone, hospital_city: h.city, messageCount: count
      });
    }
    return out;
  }

  function clausesFor(insurerId, plan) {
    var order = { covered: 1, limit: 2, waiting: 3, excluded: 4, process: 5 };
    var out = [];
    for (var i = 0; i < seed.POLICY_CLAUSES.length; i++) {
      var c = seed.POLICY_CLAUSES[i];
      if (c.insurer_id !== insurerId) continue;
      if (plan && c.plan !== plan) continue;
      out.push(c);
    }
    out.sort(function (a, b) { return (order[a.kind] || 9) - (order[b.kind] || 9); });
    return out;
  }

  function channelLabel(channel) {
    if (channel === 'call') return 'a phone call';
    if (channel === 'whatsapp') return 'WhatsApp';
    if (channel === 'video') return 'a video consult';
    return 'chat';
  }

  /** Same scoring as Repo.matchReply: specialty rules outrank generic ones. */
  function reply(specialty, body) {
    var lower = String(body).toLowerCase();
    var best = null, bestScore = 0;
    for (var r = 0; r < seed.CHAT_RULES.length; r++) {
      var rule = seed.CHAT_RULES[r];
      if (rule.specialty !== '*' && rule.specialty !== specialty) continue;
      var score = 0;
      var kws = String(rule.keywords).split(',');
      for (var k = 0; k < kws.length; k++) {
        var kw = kws[k].trim().toLowerCase();
        if (kw.length > 1 && lower.indexOf(kw) >= 0) {
          score += kw.length + (rule.specialty === '*' ? 0 : 6);
        }
      }
      if (score > bestScore) { bestScore = score; best = rule.reply; }
    }
    return best || 'Thank you, noted.';
  }

  var OPS = {
    bootstrap: function () {
      var cities = [], specialties = [];
      for (var i = 0; i < seed.HOSPITALS.length; i++) {
        if (cities.indexOf(seed.HOSPITALS[i].city) < 0) cities.push(seed.HOSPITALS[i].city);
      }
      for (var d = 0; d < seed.DOCTORS.length; d++) {
        if (specialties.indexOf(seed.DOCTORS[d].specialty) < 0) {
          specialties.push(seed.DOCTORS[d].specialty);
        }
      }
      cities.sort(); specialties.sort();
      return {
        ok: true, profile: db.profile, cities: cities, specialties: specialties,
        insurers: seed.INSURERS, conditions: seed.CONDITIONS, tests: seed.TESTS,
        seedVersion: 1
      };
    },

    save_profile: function (a) {
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) db.profile[k] = a[k];
      return { ok: true, profile: db.profile };
    },

    get_profile: function () { return { ok: true, profile: db.profile }; },

    search_doctors: function (a) {
      var list = [];
      for (var i = 0; i < seed.DOCTORS.length; i++) {
        var d = seed.DOCTORS[i];
        var h = hospital(d.hospital_id) || {};
        if (a.specialty && d.specialty !== a.specialty) continue;
        if (a.city && d.city !== a.city) continue;
        if (a.q) {
          var hay = (d.name + ' ' + d.specialty + ' ' + h.name + ' ' +
            d.qualification + ' ' + d.languages).toLowerCase();
          if (hay.indexOf(String(a.q).toLowerCase()) < 0) continue;
        }
        if (a.maxFee && d.opd_fee_min > a.maxFee) continue;
        if (a.insurerId && !(csvHas(d.insurers, a.insurerId) &&
            csvHas(h.cashless, a.insurerId))) continue;
        if (a.teleOnly && d.tele_fee <= 0) continue;
        if (a.govtSchemeOnly && d.govt_scheme !== 1) continue;
        if (a.minRating && d.rating < a.minRating) continue;
        if (a.maxDistance && (h.distance_km || 0) > a.maxDistance) continue;
        list.push(decorate(d, a.insurerId || db.profile.insurer_id || ''));
      }
      var sort = a.sort || 'value';
      list.sort(function (x, y) {
        if (sort === 'fee') return x.opd_fee_min - y.opd_fee_min;
        if (sort === 'rating') return y.rating - x.rating;
        if (sort === 'distance') return (x.distance_km || 999) - (y.distance_km || 999);
        if (sort === 'experience') return y.exp_years - x.exp_years;
        var vx = (x.rating * 220 + Math.min(x.rating_count, 300) * 0.35) / (x.opd_fee_min + 120);
        var vy = (y.rating * 220 + Math.min(y.rating_count, 300) * 0.35) / (y.opd_fee_min + 120);
        return vy - vx;
      });
      return { ok: true, doctors: list, count: list.length };
    },

    doctor: function (a) {
      var d = doctor(a.id);
      if (!d) return { ok: false, error: 'no such doctor: ' + a.id };
      var out = decorate(d, db.profile.insurer_id || '');
      var codes = [];
      for (var i = 0; i < seed.CONDITIONS.length; i++) {
        if (seed.CONDITIONS[i].specialty !== d.specialty) continue;
        var parts = String(seed.CONDITIONS[i].tests).split(',');
        for (var p = 0; p < parts.length; p++) {
          if (codes.indexOf(parts[p].trim()) < 0) codes.push(parts[p].trim());
        }
        if (codes.length > 8) break;
      }
      out.commonTests = testDetails(codes, d.city);
      out.reviews = [];
      for (var r = 0; r < db.ratings.length; r++) {
        if (db.ratings[r].target_kind === 'doctor' && db.ratings[r].target_id === a.id) {
          out.reviews.push(db.ratings[r]);
        }
      }
      return { ok: true, doctor: out };
    },

    hospitals: function (a) { return { ok: true, hospitals: hospitalsFor(a) }; },

    labs: function (a) { return { ok: true, labs: labsFor(a.city, a.tests) }; },

    estimate: function (a) {
      var city = a.city || '';
      var doc = null, opdMin = 0, opdMax = 0;
      if (a.doctorId) {
        var d = doctor(a.doctorId);
        if (d) {
          doc = { id: d.id, name: d.name, specialty: d.specialty, city: d.city,
            opd_fee_min: d.opd_fee_min, opd_fee_max: d.opd_fee_max, tele_fee: d.tele_fee };
          opdMin = d.opd_fee_min; opdMax = d.opd_fee_max;
          if (!city) city = d.city;
        }
      }
      var rows = testDetails(a.tests, city);
      var tmin = 0, tmax = 0, best = 0;
      for (var i = 0; i < rows.length; i++) {
        tmin += rows[i].typical_min;
        tmax += rows[i].typical_max;
        best += (rows[i].bestPrice !== undefined ? rows[i].bestPrice : rows[i].typical_max);
      }
      return {
        ok: true, doctor: doc, city: city, tests: rows,
        opdMin: opdMin, opdMax: opdMax,
        testsTypicalMin: tmin, testsTypicalMax: tmax, testsBestTotal: best,
        totalMin: opdMin + best, totalMax: opdMax + tmax,
        savings: Math.max(0, tmax - best),
        labs: labsFor(city, a.tests)
      };
    },

    triage: function (a) {
      var text = String(a.text || '').toLowerCase();
      var matches = [];
      for (var i = 0; i < seed.CONDITIONS.length; i++) {
        var cond = seed.CONDITIONS[i];
        var score = 0;
        var kws = String(cond.keywords).split(',');
        for (var k = 0; k < kws.length; k++) {
          var kw = kws[k].trim().toLowerCase();
          if (kw.length > 1 && text.indexOf(kw) >= 0) score += kw.length;
        }
        if (score > 0) {
          var copy = {};
          for (var c in cond) if (Object.prototype.hasOwnProperty.call(cond, c)) copy[c] = cond[c];
          copy.score = score;
          copy.testDetails = testDetails(String(cond.tests).split(','), db.profile.city || '');
          matches.push(copy);
        }
      }
      matches.sort(function (x, y) { return y.score - x.score; });
      return { ok: true, matches: matches, query: a.text };
    },

    create_booking: function (a) {
      var d = doctor(a.doctorId);
      if (!d) return { ok: false, error: 'no such doctor' };
      var id = 'bk_' + (Date.now() + db.bookings.length);
      db.bookings.push({
        id: id, doctor_id: a.doctorId, kind: a.kind, slot: a.slot || '',
        status: 'confirmed', fee: a.kind === 'tele' ? d.tele_fee : d.opd_fee_min,
        created_ts: Date.now(), reason: a.reason || '', rated: 0
      });
      if (a.kind === 'tele') {
        db.messages.push({ id: db.messages.length + 1, booking_id: id, sender: 'doctor',
          body: 'Namaskar, I am ' + d.name + ' (' + d.specialty + '). The first 10 minutes '
            + 'of this chat are free.', ts: Date.now() });
      }
      db.events.push({ name: 'booking_created', props: a.kind, ts: Date.now() });
      return { ok: true, bookingId: id, bookings: bookingsList() };
    },

    bookings: function () { return { ok: true, bookings: bookingsList() }; },

    consult_team: function () {
      var order = { primary: 1, associate: 2, coordinator: 3, insurance: 4 };
      var team = seed.CONSULTANTS.slice().sort(function (a, b) {
        return (order[a.role] || 9) - (order[b.role] || 9);
      }).map(function (c) {
        var copy = {};
        for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) copy[k] = c[k];
        copy.helpsWithList = String(c.helps_with).split(',');
        copy.languageList = String(c.languages).split(',');
        copy.available = true;   // deterministic for the test run
        copy.sample = true;
        return copy;
      });
      return {
        ok: true, team: team, topics: seed.CONSULT_TOPICS,
        requests: OPS.consult_requests().requests
      };
    },

    consult_request: function (a) {
      var consultant = null;
      for (var i = 0; i < seed.CONSULTANTS.length; i++) {
        if (seed.CONSULTANTS[i].id === a.consultantId) consultant = seed.CONSULTANTS[i];
      }
      if (!consultant) {
        for (var j = 0; j < seed.CONSULTANTS.length; j++) {
          if (seed.CONSULTANTS[j].role === 'primary') consultant = seed.CONSULTANTS[j];
        }
      }
      var id = 'cr_' + (Date.now() + db.consultRequests.length);
      db.consultRequests.push({
        id: id, consultant_id: consultant.id, channel: a.channel || 'chat',
        topic: a.topic || '', note: a.note || '',
        preferred_time: a.preferredTime || '',
        status: (a.channel || 'chat') === 'chat' ? 'open' : 'requested',
        created_ts: Date.now(), rated: 0
      });
      var first = String(db.profile.name || '').split(' ')[0];
      if ((a.channel || 'chat') === 'chat') {
        db.messages.push({ id: db.messages.length + 1, booking_id: id, sender: 'doctor',
          body: 'Namaskar' + (first ? ' ' + first : '') + ', I am ' + consultant.name
            + ', ' + consultant.title + '. ' + consultant.sla + '.', ts: Date.now() });
        if (a.note) {
          db.messages.push({ id: db.messages.length + 1, booking_id: id,
            sender: 'patient', body: a.note, ts: Date.now() });
          db.messages.push({ id: db.messages.length + 1, booking_id: id,
            sender: 'doctor', body: reply(consultant.specialty, a.note), ts: Date.now() });
        }
      } else {
        db.messages.push({ id: db.messages.length + 1, booking_id: id, sender: 'doctor',
          body: 'Request received. ' + consultant.name + ' will reach you on '
            + channelLabel(a.channel) + '.', ts: Date.now() });
      }
      db.events.push({ name: 'consult_request', props: a.channel || 'chat', ts: Date.now() });
      return { ok: true, requestId: id, consultant: consultant,
        channel: a.channel || 'chat', requests: OPS.consult_requests().requests };
    },

    consult_requests: function () {
      var out = [];
      for (var i = db.consultRequests.length - 1; i >= 0; i--) {
        var r = db.consultRequests[i];
        var c = null;
        for (var j = 0; j < seed.CONSULTANTS.length; j++) {
          if (seed.CONSULTANTS[j].id === r.consultant_id) c = seed.CONSULTANTS[j];
        }
        var count = 0;
        for (var m = 0; m < db.messages.length; m++) {
          if (db.messages[m].booking_id === r.id) count++;
        }
        var row = {};
        for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) row[k] = r[k];
        row.consultant_name = c ? c.name : '';
        row.consultant_title = c ? c.title : '';
        row.consultant_role = c ? c.role : '';
        row.specialty = c ? c.specialty : '';
        row.sla = c ? c.sla : '';
        row.hours = c ? c.hours : '';
        row.messageCount = count;
        row.channelLabel = channelLabel(r.channel);
        out.push(row);
      }
      return { ok: true, requests: out };
    },

    update_consult_request: function (a) {
      for (var i = 0; i < db.consultRequests.length; i++) {
        if (db.consultRequests[i].id === a.id) db.consultRequests[i].status = a.status;
      }
      return OPS.consult_requests();
    },

    update_booking: function (a) {
      for (var i = 0; i < db.bookings.length; i++) {
        if (db.bookings[i].id === a.id) db.bookings[i].status = a.status;
      }
      return { ok: true, bookings: bookingsList() };
    },

    messages: function (a) {
      var out = [];
      for (var i = 0; i < db.messages.length; i++) {
        if (db.messages[i].booking_id === a.bookingId) out.push(db.messages[i]);
      }
      return { ok: true, messages: out };
    },

    send_message: function (a) {
      db.messages.push({ id: db.messages.length + 1, booking_id: a.bookingId,
        sender: 'patient', body: a.body, ts: Date.now() });
      var specialty = '';
      for (var b = 0; b < db.bookings.length; b++) {
        if (db.bookings[b].id === a.bookingId) {
          var d = doctor(db.bookings[b].doctor_id);
          if (d) specialty = d.specialty;
        }
      }
      if (!specialty) {
        for (var q = 0; q < db.consultRequests.length; q++) {
          if (db.consultRequests[q].id !== a.bookingId) continue;
          for (var c2 = 0; c2 < seed.CONSULTANTS.length; c2++) {
            if (seed.CONSULTANTS[c2].id === db.consultRequests[q].consultant_id) {
              specialty = seed.CONSULTANTS[c2].specialty;
            }
          }
        }
      }
      db.messages.push({ id: db.messages.length + 1, booking_id: a.bookingId,
        sender: 'doctor', body: reply(specialty, a.body), ts: Date.now() });
      return OPS.messages(a);
    },

    rate: function (a) {
      db.ratings.push({ target_kind: a.targetKind, target_id: a.targetId,
        stars: a.stars, comment: a.comment || '', booking_id: a.bookingId || '',
        ts: Date.now() });
      for (var i = 0; i < db.bookings.length; i++) {
        if (db.bookings[i].id === a.bookingId) db.bookings[i].rated = 1;
      }
      return { ok: true };
    },

    insurance_check: function (a) {
      var insurerId = a.insurerId || db.profile.insurer_id || '';
      var ins = null;
      for (var i = 0; i < seed.INSURERS.length; i++) {
        if (seed.INSURERS[i].id === insurerId) ins = seed.INSURERS[i];
      }
      var h = a.hospitalId ? hospital(a.hospitalId) : null;
      var network = !!(h && csvHas(h.cashless, insurerId));
      var steps = network
        ? [{ n: '1', title: 'Confirm the hospital is still empanelled', detail: 'Network lists change.' },
           { n: '2', title: 'Ask for cashless pre-authorisation', detail: '48 hours before a planned admission.' },
           { n: '3', title: 'Get the approval in writing', detail: 'Ask what is excluded.' },
           { n: '4', title: 'Check the final bill line by line', detail: 'Query anything unexpected.' }]
        : [{ n: '1', title: 'This hospital is not in your cashless network', detail: 'You will likely pay first.' },
           { n: '2', title: 'Inform the insurer within 24 hours', detail: 'Late intimation reduces claims.' },
           { n: '3', title: 'Collect every original document', detail: 'Bills, reports, discharge summary.' },
           { n: '4', title: 'File within the claim window', detail: 'Usually 30 days from discharge.' }];
      var hospitalCopy = null;
      if (h) {
        hospitalCopy = {};
        for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) hospitalCopy[k] = h[k];
        hospitalCopy.insurerNames = [];
        hospitalCopy.sample = true;
      }
      db.events.push({ name: 'insurance_check', props: insurerId, ts: Date.now() });
      return {
        ok: true, insurer: ins, hospital: hospitalCopy, network: network,
        route: network ? 'cashless' : 'reimbursement', steps: steps,
        checklist: ['Insurance card or policy number', 'Photo ID (Aadhaar / voter ID)',
          'ABHA / health ID if you have one', "Doctor's admission advice letter",
          'Past reports and discharge summaries', 'A list of your current medicines'],
        clauses: clausesFor(insurerId, db.profile.plan || ''),
        networkHospitals: hospitalsFor({ insurerId: insurerId, city: a.city || '' })
      };
    },

    policy: function (a) {
      var insurerId = a.insurerId || db.profile.insurer_id || '';
      var plans = [];
      var clauses = clausesFor(insurerId, '');
      for (var i = 0; i < clauses.length; i++) {
        if (plans.indexOf(clauses[i].plan) < 0) plans.push(clauses[i].plan);
      }
      return { ok: true, plans: plans, clauses: clauses };
    },

    save_claim: function (a) {
      var id = a.id || 'cl_' + (Date.now() + db.claims.length);
      var existing = -1;
      for (var i = 0; i < db.claims.length; i++) if (db.claims[i].id === id) existing = i;
      var h = hospital(a.hospitalId) || {};
      var ins = null;
      for (var j = 0; j < seed.INSURERS.length; j++) {
        if (seed.INSURERS[j].id === a.insurerId) ins = seed.INSURERS[j];
      }
      var claim = { id: id, hospital_id: a.hospitalId, insurer_id: a.insurerId,
        plan: a.plan || '', route: a.route || '', status: a.status || 'started',
        amount: a.amount || 0, created_ts: Date.now(), notes: a.notes || '',
        hospital_name: h.name, insurer_name: ins ? ins.name : '',
        helpline: ins ? ins.helpline : '' };
      if (existing >= 0) db.claims[existing] = claim; else db.claims.push(claim);
      return { ok: true, claims: db.claims.slice().reverse() };
    },

    claims: function () { return { ok: true, claims: db.claims.slice().reverse() }; },

    records: function () { return { ok: true, records: db.records.slice().reverse() }; },

    save_record: function (a) {
      var id = a.id || 'rec_' + (Date.now() + db.records.length);
      var found = -1;
      for (var i = 0; i < db.records.length; i++) if (db.records[i].id === id) found = i;
      var rec = { id: id, kind: a.kind, title: a.title, body: a.body, ts: Date.now() };
      if (found >= 0) db.records[found] = rec; else db.records.push(rec);
      return { ok: true, records: db.records.slice().reverse() };
    },

    delete_record: function (a) {
      db.records = db.records.filter(function (r) { return r.id !== a.id; });
      return { ok: true, records: db.records.slice().reverse() };
    },

    log_event: function (a) {
      db.events.push({ name: a.name, props: a.props || '', ts: Date.now() });
      return { ok: true };
    },

    metrics: function () {
      function count(name) {
        var n = 0;
        for (var i = 0; i < db.events.length; i++) if (db.events[i].name === name) n++;
        return n;
      }
      var patientMsgs = 0;
      for (var m = 0; m < db.messages.length; m++) {
        if (db.messages[m].sender === 'patient') patientMsgs++;
      }
      var completed = 0;
      for (var b = 0; b < db.bookings.length; b++) {
        if (db.bookings[b].status === 'completed') completed++;
      }
      return {
        ok: true,
        funnel: {
          searches: count('search'), doctorViews: count('doctor_view'),
          bookings: db.bookings.length, teleMessages: patientMsgs,
          completed: completed, ratings: db.ratings.length,
          insuranceChecks: count('insurance_check'),
          consultRequests: db.consultRequests.length
        },
        byDay: [{ day: new Date().toISOString().slice(0, 10), n: db.events.length }],
        recent: db.events.slice(-30).reverse(),
        firstSeen: db.events.length ? db.events[0].ts : 0
      };
    },

    reset_data: function () {
      db.profile = {}; db.bookings = []; db.messages = []; db.ratings = [];
      db.records = []; db.claims = []; db.events = []; db.consultRequests = [];
      return { ok: true };
    }
  };

  window.MedNav = {
    call: function (op, argsJson) {
      var args = {};
      try { args = argsJson ? JSON.parse(argsJson) : {}; } catch (e) { args = {}; }
      window.__MEDNAV_CALLS.push(op);
      if (!OPS[op]) return JSON.stringify({ ok: false, error: 'unknown op: ' + op });
      try {
        return JSON.stringify(OPS[op](args));
      } catch (e) {
        return JSON.stringify({ ok: false, error: 'mock threw on ' + op + ': ' + e.message });
      }
    },
    share: function (t) { window.__MEDNAV_SHARE = t; },
    dial: function (n) { window.__MEDNAV_DIAL = n; },
    copy: function () {},
    toast: function (m) { window.__MEDNAV_TOAST = m; },
    vibrate: function () {},
    appInfo: function () {
      return JSON.stringify({ ok: true, versionName: '1.0.0-test', versionCode: 1,
        buildStamp: 'test', androidRelease: '14', sdkInt: 34,
        device: 'headless chromium', packageName: 'com.mednav.navigator' });
    },
    finishApp: function () { window.__MEDNAV_EXIT = true; }
  };
}());
