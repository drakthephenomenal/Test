// ═══════════════════════════════════════════════════════════════
//  VOICE JAP — Exact Naam Recognition
//  Radha mode:  say "Radha" / "राधा"  → 1 jap
//  RV mode:     say "Radha Vallabh Sri Harivansha" / full naam → 1 jap
//  Nothing else counts.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Accepted phrases — EXACT match only ─────────────────────
  // Radha mode: only "Radha" or "राधा"
  var RADHA_EXACT = ['radha', 'राधा'];

  // RV mode: only the full naam (various speech-engine spellings)
  var RV_EXACT = [
    'radha vallabh shri harivansha',
    'radha vallabh sri harivansha',
    'radha vallabh shri harivangsha',
    'radha vallabh sri harivangsha',
    'radha vallabh shri harivansh',
    'radha vallabh sri harivansh',
    'राधावल्लभ श्री हरिवंश',
    'राधा वल्लभ श्री हरिवंश',
  ];

  function isMatch(transcript) {
    var t = transcript.toLowerCase().trim();
    var isRV = typeof App !== 'undefined' && App.S && App.S.japMode === 'rv';

    if (isRV) {
      // Must contain the full RV naam
      for (var i = 0; i < RV_EXACT.length; i++) {
        if (t === RV_EXACT[i] || t.indexOf(RV_EXACT[i]) !== -1) return true;
      }
      return false;
    } else {
      // Must be exactly "radha" / "राधा" — nothing more, nothing less
      for (var j = 0; j < RADHA_EXACT.length; j++) {
        if (t === RADHA_EXACT[j]) return true;
      }
      return false;
    }
  }

  // ── State ────────────────────────────────────────────────────
  var VJ = {
    active:       false,
    recognition:  null,
    sessionCount: 0,
    btn:          null,
    countEl:      null,
    statusEl:     null,
    _restarting:  false,
    _lastMatch:   0,

    // Simulate EXACT same tap as finger on the mala center
    fireTap: function () {
      var zone = document.getElementById('tz');
      if (!zone) return;
      var r  = zone.getBoundingClientRect();
      var cx = r.left + r.width  / 2;
      var cy = r.top  + r.height / 2;
      var fakeEvent = {
        preventDefault: function () {},
        clientX: cx, clientY: cy, touches: null
      };
      if (typeof App !== 'undefined' && typeof App.ht === 'function') {
        App.ht(fakeEvent);
      }
      this.sessionCount++;
      if (this.countEl) this.countEl.textContent = this.sessionCount;
    },

    start: function () {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { this.showStatus('⚠️ Speech recognition not supported', 'warn'); return; }
      if (this.active) { this.stop(); return; }
      this.active = true;
      this.sessionCount = 0;
      if (this.countEl) this.countEl.textContent = '0';
      this.updateBtn(true);
      var isRV = typeof App !== 'undefined' && App.S && App.S.japMode === 'rv';
      this.showStatus(isRV ? '🎙️ Say "Radha Vallabh Sri Harivansha"' : '🎙️ Say "Radha"', 'on');
      this._startRec();
    },

    _startRec: function () {
      if (!this.active) return;
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      var rec = new SR();
      this.recognition = rec;
      rec.lang = 'hi-IN';          // Hindi primary — picks up both Hindi & English
      rec.continuous = false;       // one utterance at a time — cleaner for single naam
      rec.interimResults = false;   // final results only — avoids partial false matches
      rec.maxAlternatives = 5;      // try more alternatives to catch pronunciation variants

      var self = this;

      rec.onresult = function (e) {
        var now = Date.now();
        if (now - self._lastMatch < 500) return; // debounce

        for (var i = 0; i < e.results.length; i++) {
          var result = e.results[i];
          for (var j = 0; j < result.length; j++) {
            var transcript = result[j].transcript;
            if (isMatch(transcript)) {
              self._lastMatch = now;
              self.fireTap();
              self.showStatus('✅ ' + transcript.trim(), 'hit');
              return;
            }
          }
        }
        // Heard something but didn't match — show it so user knows
        var heard = e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
        if (heard) self.showStatus('❌ "' + heard + '" — not recognised', 'warn');
      };

      rec.onerror = function (e) {
        if (e.error === 'no-speech') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          self.stop(); self.showStatus('⚠️ Mic permission denied', 'warn'); return;
        }
      };

      rec.onend = function () {
        // Restart after each utterance so it keeps listening
        if (self.active && !self._restarting) {
          self._restarting = true;
          setTimeout(function () {
            self._restarting = false;
            if (self.active) self._startRec();
          }, 150);
        }
      };

      try { rec.start(); } catch(e) {}
    },

    stop: function () {
      this.active = false;
      if (this.recognition) { try { this.recognition.stop(); } catch(e){} this.recognition = null; }
      this.updateBtn(false);
      this.showStatus('', '');
      if (typeof toast === 'function') toast('🎤 Voice Jap OFF · ' + this.sessionCount + ' naam counted 🙏');
    },

    updateBtn: function (on) {
      if (!this.btn) return;
      if (on) {
        this.btn.innerHTML = '<span class="vjd-live-dot"></span> Voice Jap ON';
        this.btn.classList.add('vjd-on');
      } else {
        this.btn.innerHTML = '🎤 Voice Jap';
        this.btn.classList.remove('vjd-on');
      }
    },

    showStatus: function (msg, state) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.className = 'vjd-status vjd-s-' + (state || '');
    },

    mount: function () {
      var self = this;

      var style = document.createElement('style');
      style.textContent =
        '#vjd-wrap{display:flex;flex-direction:column;gap:5px;margin:8px 0 2px;}' +
        '#vjd-row{display:flex;align-items:center;gap:10px;}' +
        '#vjd-btn{flex:1;padding:10px 16px;border-radius:22px;border:1px solid rgba(26,212,117,0.3);background:rgba(26,212,117,0.07);color:#1ad475;font-size:13px;font-weight:700;font-family:"Inter",sans-serif;cursor:pointer;letter-spacing:0.4px;transition:all 0.25s;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;gap:8px;}' +
        '#vjd-btn:active{transform:scale(0.95);}' +
        '#vjd-btn.vjd-on{background:rgba(232,51,109,0.12);border-color:rgba(232,51,109,0.45);color:#ff6b8a;}' +
        '.vjd-live-dot{width:9px;height:9px;border-radius:50%;background:#ff4060;flex-shrink:0;animation:vjd-p 1s infinite;}' +
        '@keyframes vjd-p{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.6);}}' +
        '#vjd-count{min-width:38px;text-align:center;font-size:16px;font-weight:800;color:rgba(255,255,255,0.7);font-family:"Inter",sans-serif;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:4px 8px;}' +
        '.vjd-status{font-size:12px;font-family:"Inter",sans-serif;min-height:15px;padding:0 4px;transition:color 0.2s;}' +
        '.vjd-s-on{color:rgba(26,212,117,0.8);}' +
        '.vjd-s-hit{color:#FFD700;font-weight:700;}' +
        '.vjd-s-warn{color:#ff6b6b;}' +
        '#vjd-hint{font-size:10px;color:rgba(255,255,255,0.25);font-family:"Inter",sans-serif;line-height:1.5;padding:0 2px;}';
      document.head.appendChild(style);

      var timerToday = document.getElementById('timerToday');
      if (!timerToday) { setTimeout(function(){ self.mount(); }, 600); return; }

      var wrap = document.createElement('div'); wrap.id = 'vjd-wrap';
      var row  = document.createElement('div'); row.id  = 'vjd-row';

      var btn = document.createElement('button'); btn.id = 'vjd-btn';
      btn.innerHTML = '🎤 Voice Jap';
      btn.onclick = function () { VJ.active ? VJ.stop() : VJ.start(); };
      this.btn = btn;

      var countEl = document.createElement('div'); countEl.id = 'vjd-count';
      countEl.title = 'Naam counted this session'; countEl.textContent = '0';
      this.countEl = countEl;

      var statusEl = document.createElement('div'); statusEl.className = 'vjd-status';
      this.statusEl = statusEl;

      var hint = document.createElement('div'); hint.id = 'vjd-hint';
      hint.textContent = 'Radha mode: say "Radha" only · RV mode: say full "Radha Vallabh Sri Harivansha" only';

      row.appendChild(btn); row.appendChild(countEl);
      wrap.appendChild(row); wrap.appendChild(statusEl); wrap.appendChild(hint);
      timerToday.parentNode.insertBefore(wrap, timerToday.nextSibling);
    }
  };

  window.VoiceJap = VJ;

  function tryMount() {
    if (document.getElementById('vjd-btn')) return;
    if (document.getElementById('timerToday')) { VJ.mount(); return; }
    setTimeout(tryMount, 500);
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', function(){ setTimeout(tryMount, 900); })
    : setTimeout(tryMount, 900);
})();
