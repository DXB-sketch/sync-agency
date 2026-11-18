/* Sync Rewards — crate sound and haptics.
   Sound: synthesised with the Web Audio API (no files to load). Starts on the first tap.
   Haptics: Capacitor Haptics inside the native app, navigator.vibrate on Android web, silent elsewhere. */
window.CrateFX = (function () {
  var ctx = null, out = null, muted = false, hapTimers = [];

  function ac() {
    if (muted) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        out = ctx.createGain(); out.gain.value = 0.7;
        out.connect(comp); comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(c, f, t, dur, type, vol, f2) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  var noiseBuf = null;
  function noise(c, t, dur, vol, ftype, f, f2) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    fl.type = ftype || 'bandpass';
    fl.frequency.setValueAtTime(f || 2000, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t); s.stop(t + dur + 0.05);
  }

  function haptic(kind) {
    try {
      var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (H) {
        if (kind === 'success') H.notification({ type: 'SUCCESS' });
        else if (kind === 'jackpot') { H.notification({ type: 'SUCCESS' }); setTimeout(function () { H.impact({ style: 'HEAVY' }); }, 180); setTimeout(function () { H.impact({ style: 'HEAVY' }); }, 360); }
        else H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
        return;
      }
      if (navigator.vibrate) {
        navigator.vibrate({ light: 8, medium: 18, heavy: [45, 25, 70], success: [20, 40, 30], jackpot: [30, 40, 30, 40, 120, 60, 160] }[kind] || 8);
      }
    } catch (e) {}
  }

  function cancel() { hapTimers.forEach(clearTimeout); hapTimers = []; }

  return {
    /* tap the crate: a solid wooden knock */
    tap: function () {
      haptic('medium');
      var c = ac(); if (!c) return; var t = c.currentTime;
      tone(c, 160, t, 0.18, 'sine', 0.5, 55);
      noise(c, t, 0.06, 0.25, 'bandpass', 1800);
    },
    /* the build-up: rattles that speed up over a rising whoosh, haptic tick on every rattle */
    shake: function (total) {
      total = total || 1.4;
      cancel();
      var times = [], at = 0, gap = 0.2;
      while (at < total - 0.05) { times.push(at); at += gap; gap = Math.max(0.045, gap * 0.82); }
      times.forEach(function (tt, i) {
        hapTimers.push(setTimeout(function () { haptic(i / times.length > 0.6 ? 'medium' : 'light'); }, tt * 1000));
      });
      var c = ac(); if (!c) return; var t = c.currentTime;
      times.forEach(function (tt, i) {
        var p = i / times.length;
        noise(c, t + tt, 0.05, 0.18 + p * 0.25, 'bandpass', 2600 + p * 1800);
        tone(c, 210 + p * 120, t + tt, 0.07, 'triangle', 0.18 + p * 0.2, 120);
      });
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(420, t + total);
      f.type = 'lowpass'; f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(3200, t + total);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + total);
      g.gain.exponentialRampToValueAtTime(0.0001, t + total + 0.08);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + total + 0.1);
      noise(c, t, total, 0.12, 'highpass', 600, 5000);
    },
    /* the lid blows off: sub boom, crack, glitter */
    burst: function () {
      cancel(); haptic('heavy');
      var c = ac(); if (!c) return; var t = c.currentTime;
      tone(c, 110, t, 0.7, 'sine', 0.9, 32);
      noise(c, t, 0.5, 0.55, 'lowpass', 2400, 200);
      noise(c, t, 0.12, 0.4, 'highpass', 3000);
      for (var i = 0; i < 10; i++) tone(c, 2200 + Math.random() * 3200, t + 0.08 + i * 0.035, 0.18, 'sine', 0.08);
    },
    /* the reveal: a chime that grows with rarity, a full fanfare for legendary */
    reveal: function (rarity) {
      haptic(rarity === 'legendary' ? 'jackpot' : 'success');
      var c = ac(); if (!c) return; var t = c.currentTime + 0.05;
      var N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };
      var seq = {
        common: ['C5', 'E5', 'G5'],
        rare: ['C5', 'E5', 'G5', 'C6'],
        epic: ['C5', 'E5', 'G5', 'C6', 'E6'],
        legendary: ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7']
      }[rarity] || ['C5', 'E5', 'G5'];
      seq.forEach(function (n, i) {
        tone(c, N[n], t + i * 0.075, 0.5, 'triangle', 0.3);
        tone(c, N[n] * 2, t + i * 0.075, 0.25, 'sine', 0.08);
      });
      var end = t + seq.length * 0.075;
      var chord = rarity === 'legendary' ? ['C5', 'E5', 'G5', 'C6', 'E6'] : rarity === 'epic' ? ['C5', 'G5', 'E6'] : ['C6', 'G5'];
      chord.forEach(function (n) { tone(c, N[n], end, rarity === 'legendary' ? 2.2 : 1.1, 'sine', rarity === 'legendary' ? 0.16 : 0.12); });
      if (rarity === 'legendary' || rarity === 'epic') {
        for (var i = 0; i < 18; i++) tone(c, 2600 + Math.random() * 3000, end + i * 0.06, 0.2, 'sine', 0.05);
        noise(c, end, 1.4, 0.08, 'highpass', 6000);
      }
    },
    /* the value counting up: a tiny tick that climbs in pitch */
    tick: function (p) {
      var c = ac(); if (!c) return;
      tone(c, 900 + p * 900, c.currentTime, 0.035, 'square', 0.035);
    },
    /* collect: two-note coin pickup */
    coin: function () {
      haptic('light');
      var c = ac(); if (!c) return; var t = c.currentTime;
      tone(c, 987.77, t, 0.08, 'square', 0.12);
      tone(c, 1318.5, t + 0.07, 0.3, 'square', 0.12);
    },
    cancel: cancel,
    setMuted: function (m) { muted = !!m; if (muted) cancel(); },
    isMuted: function () { return muted; }
  };
})();
