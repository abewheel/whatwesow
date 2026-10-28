// Discourse Layer engine. Pure: no DOM. Needs CONTENT (content.js in a page, or set globalThis.CONTENT in Node).
(function (root) {
  'use strict';
  const C = root.CONTENT;
  const ORDER_FOR = { proposal: 'resolveThenShift', lobby: 'resolveThenShift', center: 'shiftThenResolve' };
  const crisisById = {}, cardById = {};
  C.crises.forEach(c => { crisisById[c.id] = c; });
  C.cards.forEach(c => { cardById[c.id] = c; });

  function defaults(resolution) {
    const p = C.params, r = ORDER_FOR[resolution] ? resolution : 'proposal';
    return {
      resolution: r, order: ORDER_FOR[r],
      startCenter: p.startCenter, halfWidth: p.halfWidth, oppositionShift: p.oppositionShift,
      spacing: p.spacing, extreme: p.extreme
    };
  }

  // Missing keys fall back to the content params; order falls back to the rule's default.
  function normalize(config) {
    const c = config || {};
    const out = defaults(c.resolution);
    Object.keys(c).forEach(k => { if (c[k] !== undefined && c[k] !== null && c[k] !== '') out[k] = c[k]; });
    return out;
  }

  function rungs(cfg) {
    const s = cfg.spacing, out = [];
    if (!(s > 0)) return [0];
    for (let p = s * Math.ceil(-cfg.extreme / s); p <= cfg.extreme; p += s) out.push(p + 0);
    return out;
  }

  function clamp(pos, center, cfg) {
    const s = cfg.spacing;
    const low = center - cfg.halfWidth, high = center + cfg.halfWidth;
    const lowRung = Math.max(-cfg.extreme, s * Math.ceil(low / s));
    const highRung = Math.min(cfg.extreme, s * Math.floor(high / s));
    return Math.max(lowRung, Math.min(highRung, pos)) + 0;
  }

  // Nearest rung; on an exact tie keep prev if it is one of the two, else the one nearer 0.
  function nearestRung(center, cfg, prev) {
    let best = Infinity, cands = [];
    rungs(cfg).forEach(r => {
      const d = Math.abs(center - r);
      if (d < best - 1e-9) { best = d; cands = [r]; } else if (Math.abs(d - best) <= 1e-9) cands.push(r);
    });
    if (cands.length === 1) return cands[0];
    if (cands.indexOf(prev) >= 0) return prev;
    return cands.slice().sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  }

  function policyAt(crisis, pos) {
    return crisis.policies.find(p => p.pos === pos) || {
      pos, name: '(no policy at ' + pos + ')', immediate: 'None', drag: 'None', modifier: '—',
      tilesLost: 0, offer: false, offerTiles: 0, missing: true
    };
  }

  function cardsFor(crisisId) { return C.cards.filter(c => c.crisis === crisisId); }

  // A pick is a card id, optionally with ":accept" / ":decline" for an offer answered in play.
  function parsePick(raw) {
    const s = String(raw), i = s.lastIndexOf(':');
    if (i > 0 && (s.slice(i + 1) === 'accept' || s.slice(i + 1) === 'decline')) return { cardId: s.slice(0, i), decision: s.slice(i + 1) };
    return { cardId: s, decision: null };
  }

  // Index of the last shift that went from a center satisfying `from` to one satisfying `to`, or -1.
  function lastMove(shifts, from, to) {
    for (let j = shifts.length - 1; j >= 0; j--) if (from(shifts[j][0]) && to(shifts[j][1])) return j;
    return -1;
  }

  function replay(picks, config) {
    const cfg = normalize(config);
    const order = C.params.runOrder;
    const sTR = cfg.order === 'shiftThenResolve';
    const ledger = [], enacted = [], standing = [];
    let center = cfg.startCenter, tilesTaken = 0, tilesSold = 0;

    (picks || []).slice(0, order.length).forEach((raw, i) => {
      const pick = parsePick(raw);
      const crisis = crisisById[order[i]];
      const card = cardById[pick.cardId];
      if (!card || card.crisis !== crisis.id) throw new Error('Pick ' + (i + 1) + ' ("' + raw + '") is not a card for ' + crisis.id);

      const net = card.explicitShift + cfg.oppositionShift;
      const before = center, after = center + net;
      const at = sTR ? after : before;
      const prevPos = enacted.length ? enacted[enacted.length - 1].pos : null;
      // Shifts that had happened by the time this crisis resolved.
      const shifts = ledger.map(r => [r.before, r.after]);
      if (sTR) shifts.push([before, after]);

      let ask = null, askSource = null, pos, kind = null, k = -1, edge = null;
      if (cfg.resolution === 'center') {
        pos = nearestRung(at, cfg, prevPos);
        if (prevPos !== null && pos !== prevPos) { kind = 'moved'; k = sTR ? i : i - 1; }
        else {
          const inZone = c => nearestRung(c, cfg, null) === pos;
          k = lastMove(shifts, c => !inZone(c), inZone);
          kind = k >= 0 ? 'entered' : 'sinceStart';
        }
      } else {
        askSource = cfg.resolution === 'lobby' ? 'lobby' : 'proposal';
        ask = askSource === 'lobby' ? crisis.lobbyAsk : card.conclusionPos;
        pos = clamp(ask, at, cfg);
        if (pos !== ask) {
          const up = ask > pos;
          const T = up ? ask - cfg.halfWidth : ask + cfg.halfWidth;
          const included = up ? (c => c >= T) : (c => c <= T);
          k = lastMove(shifts, included, c => !included(c));
          kind = k >= 0 ? 'crossed' : 'outsideFromStart';
          edge = up ? at + cfg.halfWidth : at - cfg.halfWidth;
        }
      }

      const policy = policyAt(crisis, pos);
      tilesTaken += policy.tilesLost;
      let accepted = null, sold = 0;
      if (policy.offer) {
        accepted = pick.decision ? pick.decision === 'accept'
          : (typeof cfg.acceptOffers === 'boolean' ? cfg.acceptOffers : null);
        if (accepted) { sold = policy.offerTiles; tilesSold += sold; }
      }
      // An offer's drag only binds if the offer was taken.
      if (policy.drag && policy.drag !== 'None' && (!policy.offer || accepted === true)) {
        const key = crisis.id + '@' + pos;
        if (!standing.some(s => s.key === key)) standing.push({ key, crisisId: crisis.id, pos, policy: policy.name, text: policy.drag });
      }
      enacted.push({ crisisId: crisis.id, pos });

      ledger.push({
        n: i + 1, crisisId: crisis.id, cardId: card.id, persona: card.persona, premiseType: card.premiseType,
        explicitShift: card.explicitShift, oppositionShift: cfg.oppositionShift, net,
        before, after, ask, askSource, inWindow: ask === null ? null : ask === pos,
        enactedPos: pos, enactedName: policy.name,
        tilesLost: policy.tilesLost, offer: !!policy.offer, accepted,
        attributionCrisis: kind === null ? null : k + 1,
        // extras for the screens
        crisisTitle: crisis.title, cardType: card.cardType, resolvedAt: at,
        windowLow: at - cfg.halfWidth, windowHigh: at + cfg.halfWidth, edge,
        attributionKind: kind, sold
      });
      center = after;
    });

    return {
      config: cfg, center, ledger, enacted, standing, tilesTaken, tilesSold,
      tilesRemaining: Math.max(0, C.params.farmTiles - tilesTaken - tilesSold),
      done: ledger.length >= order.length
    };
  }

  // ---------- headless runner ----------
  function toCard(choice, hand) {
    if (choice && typeof choice === 'object') choice = choice.id;
    const card = hand.find(c => c.id === choice) || hand.find(c => c.key === choice);
    if (!card) throw new Error('No card "' + choice + '" in ' + hand[0].crisis);
    return card;
  }

  function strategyLabel(strategy) {
    if (typeof strategy === 'function') return strategy.name || 'function';
    return Array.isArray(strategy) ? strategy.join(',') : String(strategy);
  }

  function run(strategy, config) {
    const cfg = normalize(Object.assign({ acceptOffers: true }, config));
    const picks = [];
    let state = replay(picks, cfg);
    C.params.runOrder.forEach((crisisId, i) => {
      const hand = cardsFor(crisisId);
      const choice = typeof strategy === 'function' ? strategy(state, hand)
        : Array.isArray(strategy) ? strategy[i] : strategy;
      picks.push(toCard(choice, hand).id);
      state = replay(picks, cfg);
    });
    return {
      config: cfg, picks, ledger: state.ledger,
      final: {
        center: state.center, tilesTaken: state.tilesTaken, tilesSold: state.tilesSold,
        passedAsWritten: state.ledger.filter(r => r.inWindow === true).length,
        policies: state.ledger.map(r => r.enactedPos),
        standing: state.standing.map(s => s.policy + ': ' + s.text)
      }
    };
  }

  function compare(strategies, config) {
    const results = strategies.map(s => run(s, config));
    console.table(results.map((r, i) => ({
      strategy: strategyLabel(strategies[i]), rule: r.config.resolution, order: r.config.order,
      start: r.config.startCenter, center: r.final.center, tilesTaken: r.final.tilesTaken,
      tilesSold: r.final.tilesSold, passedAsWritten: r.final.passedAsWritten, policies: r.final.policies.join(',')
    })));
    return results;
  }

  function tests() {
    const pinned = { startCenter: 10, halfWidth: 40, oppositionShift: -5, spacing: 40, extreme: 80 };
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const check = (cfg, key, center, tiles, policies) => {
      const f = run(key, Object.assign({}, pinned, cfg)).final;
      return { pass: f.center === center && f.tilesTaken === tiles && same(f.policies, policies), f };
    };
    const show = f => f.center + ' · ' + f.tilesTaken + ' tiles · ' + f.policies.join(',');
    let ok = true;
    const proposal = { resolution: 'proposal', order: 'resolveThenShift' };
    [['LIB-P', -30, 4, [40, 40, 40, 0, 0, 0, 0, 0]],
     ['LIB-M', -78, 15, [40, 0, 0, 0, 0, -40, -40, -40]],
     ['OBJ', 50, 0, [40, 40, 40, 40, 40, 40, 80, 80]]].forEach(([key, center, tiles, pols]) => {
      const r = check(proposal, key, center, tiles, pols);
      ok = ok && r.pass;
      console.log((r.pass ? 'PASS ' : 'FAIL ') + 'proposal, start 10, ' + key + ': ' + show(r.f) +
        (r.pass ? '' : '   expected ' + center + ' · ' + tiles + ' tiles · ' + pols.join(',')));
    });
    const R = 'resolveThenShift', S = 'shiftThenResolve';
    [[{ resolution: 'lobby', order: R, startCenter: 10 }, 'LIB-P', -30, 26, [0, 0, -40, -40, -40, -40, -40, -40]],
     [{ resolution: 'lobby', order: R, startCenter: 10 }, 'LIB-M', -78, 26, [0, -40, -40, -40, -40, -40, -40, -40]],
     [{ resolution: 'lobby', order: R, startCenter: 10 }, 'OBJ', 50, 8, [0, 0, 0, 0, 0, 0, 0, 40]],
     [{ resolution: 'lobby', order: R, startCenter: 50 }, 'LIB-P', 10, 8, [40, 40, 0, 0, 0, 0, 0, 0]],
     [{ resolution: 'lobby', order: R, startCenter: 50 }, 'LIB-M', -38, 15, [40, 0, 0, 0, 0, -40, -40, -40]],
     [{ resolution: 'lobby', order: R, startCenter: 50 }, 'OBJ', 90, 0, [40, 40, 40, 40, 40, 40, 40, 80]],
     [{ resolution: 'center', order: S, startCenter: 35 }, 'LIB-P', -5, 4, [40, 40, 40, 0, 0, 0, 0, 0]],
     [{ resolution: 'center', order: S, startCenter: 35 }, 'LIB-M', -53, 15, [40, 0, 0, 0, 0, -40, -40, -40]],
     [{ resolution: 'center', order: S, startCenter: 35 }, 'OBJ', 75, 0, [40, 40, 40, 40, 40, 80, 80, 80]]
    ].forEach(([cfg, key, center, tiles, pols]) => {
      const r = check(cfg, key, center, tiles, pols);
      console.log('ref  ' + (r.pass ? 'matches ' : 'DIFFERS ') + cfg.resolution + ', start ' + cfg.startCenter + ', ' + key + ': ' + show(r.f) +
        (r.pass ? '' : '   brief: ' + center + ' · ' + tiles + ' tiles · ' + pols.join(',')));
    });
    console.log(ok ? 'sim.tests(): all acceptance tests pass' : 'sim.tests(): FAILED');
    return ok;
  }

  // ---------- the hand ----------
  function seededShuffle(list, seed) {
    let a = seed >>> 0;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  // The cards the player chooses from at crisis number n (0-based): params.handKeys in that order,
  // or, without the list, all six shuffled by crisis index so a replay shows the same order.
  function hand(crisisId, n) {
    const keys = C.params.handKeys;
    return keys ? keys.map(k => cardsFor(crisisId).find(c => c.key === k)).filter(Boolean)
      : seededShuffle(cardsFor(crisisId), 1013 * (n + 1));
  }

  // The case for control, made every crisis whatever the player picks.
  function opposition(crisisId) { return cardsFor(crisisId).find(c => c.key === 'SOC'); }

  // The farm-side effects to apply for a ledger record: the enacted policy's effects, minus any
  // that only bind when an offer is accepted (while the offer is unanswered or declined).
  function effectsFor(record) {
    const policy = policyAt(crisisById[record.crisisId], record.enactedPos);
    return (policy.effects || []).filter(e => !e.onAccept || record.accepted === true);
  }

  // ---------- player-facing text (plain strings; the page escapes them) ----------
  const S = C.strings || {};
  const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    const v = Math.round(n * 10) / 10;
    return v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';
  }
  // "10 points toward freedom" / "5 points toward control"
  function amount(n) {
    const v = Math.round(Math.abs(n) * 10) / 10, vars = { n: v, points: v === 1 ? S.point : S.points };
    return n > 0 ? fill(S.amountFreedom, vars) : fill(S.amountControl, vars);
  }
  const position = n => (Math.round(n * 10) === 0 ? S.positionCenter : fill(S.positionLean, { amount: amount(n) }));
  const moved = n => (n ? amount(n) : 'not at all');
  const immediate = policy => (policy.immediate === 'None' ? S.noImmediate : policy.immediate);
  // "Practical libertarian · What works"
  const label = card => fill(S.argumentType, { persona: card.personaLabel || card.persona, type: S.premiseLabel[card.premiseType] });

  const answer = record => S.answer[record.premiseType];

  function shift(record) {
    const oppLabel = record.premiseType === 'moral_rights' ? S.oppositionAnswered : S.oppositionUnanswered;
    return [
      record.explicitShift ? fill(S.shiftMine, { amount: amount(record.explicitShift) }) : S.shiftMineNone,
      record.oppositionShift ? fill(S.shiftOpp, { oppLabel, amount: amount(record.oppositionShift) }) : '',
      fill(record.net ? S.shiftNet : S.shiftNetNone, { amount: record.net ? amount(record.net) : '', position: position(record.after) })
    ].filter(Boolean).join(' ');
  }

  // Numeric placeholders ({pos}, {edge}, {center}…) stay available for anyone who wants them back in the wording.
  function resolution(record) {
    const crisis = crisisById[record.crisisId];
    const vars = { enacted: record.enactedName, enactedPos: fmt(record.enactedPos), lobby: crisis.lobby, center: fmt(record.resolvedAt) };
    if (record.ask !== null) Object.assign(vars, { policy: policyAt(crisis, record.ask).name, pos: fmt(record.ask), edge: fmt(record.edge) });
    if (record.askSource === 'proposal') return fill(record.inWindow ? S.proposalIn : S.proposalOut, vars);
    if (record.askSource === 'lobby') return fill(record.inWindow ? S.lobbyIn : S.lobbyOut, vars);
    return fill(S.centerLine, Object.assign(vars, { policy: record.enactedName }));
  }

  // Which earlier argument put the ask out of reach (or moved the council here). '' when there is nothing to say.
  function attribution(record, state) {
    const k = record.attributionCrisis, kind = record.attributionKind;
    if (kind === null) return '';
    const crisis = crisisById[record.crisisId];
    const asked = record.ask === null ? '' : policyAt(crisis, record.ask).name, policy = record.enactedName;
    if (kind === 'outsideFromStart') return fill(S.attributionStart, { asked });
    if (kind === 'sinceStart') return fill(S.centerStart, { policy });
    const by = cardById[state.ledger[k - 1].cardId], title = crisisById[C.params.runOrder[k - 1]].title;
    const tpl = kind === 'crossed' ? S.attribution : kind === 'moved' ? S.centerMoved : S.centerHeld;
    return fill(tpl, { k, title, asked, policy, argument: by.argument, tail: S.answerPast[by.premiseType] });
  }

  const offerResult = record => (!record.offer || record.accepted === null ? '' : record.accepted ? S.offerAccepted : S.offerDeclined);

  // Everything the result screen says after pick number i (0-based) in `state`, in display order.
  function reveal(state, i) {
    const record = state.ledger[i === undefined ? state.ledger.length - 1 : i];
    const crisis = crisisById[record.crisisId], card = cardById[record.cardId];
    const policy = policyAt(crisis, record.enactedPos), soc = opposition(crisis.id);
    return {
      heading: fill(S.crisisHeading, { n: record.n, total: C.params.runOrder.length, title: crisis.title }),
      argument: card.argument, label: label(card),
      opposition: card.key === 'SOC' ? null : { lead: S.revealOpposition, argument: soc.argument, label: label(soc) },
      answer: answer(record), shift: shift(record), resolution: resolution(record), attribution: attribution(record, state),
      immediateHeading: S.immediateHeading, immediate: immediate(policy),
      offer: !record.offer ? null : record.accepted === null ? 'pending' : record.accepted ? 'accepted' : 'declined',
      offerResult: offerResult(record),
      standing: state.standing.map(s => s.policy + ': ' + s.text),
      effects: effectsFor(record)
    };
  }

  const text = { fill, fmt, amount, position, moved, immediate, label, answer, shift, resolution, attribution, offerResult, reveal };

  root.Engine = { replay, normalize, defaults, rungs, clamp, nearestRung, policyAt, cardsFor, parsePick, crisisById, cardById, ORDER_FOR,
    hand, opposition, effectsFor, text };
  root.sim = { run, compare, tests };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Engine: root.Engine, sim: root.sim };
})(typeof window !== 'undefined' ? window : globalThis);
