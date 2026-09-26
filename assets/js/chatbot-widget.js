(function () {
  'use strict';

  // ← Replace with your deployed worker URL after running `npm run deploy`
  var WORKER_URL = 'https://thankheaven-chat.zaddywebbuilds.workers.dev';

  var messages = [];
  var isOpen   = false;
  var isBusy   = false;

  // ─── Build DOM ────────────────────────────────────────────────────────────

  function init() {
    var el = document.createElement('div');
    el.id  = 'thc';
    el.innerHTML = [
      '<button class="thc-bubble" id="thcBubble" aria-label="Booking and inquiries">',
        '<svg class="thc-bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        '<span class="thc-bubble-label">BOOKING &amp; INQUIRIES</span>',
        '<span class="thc-pulse" id="thcBadge" hidden></span>',
      '</button>',

      '<div class="thc-panel" id="thcPanel" aria-hidden="true">',
        '<div class="thc-head">',
          '<img class="thc-head-img" src="assets/img/chat-header.webp" alt="Maui Sands Seaside view" />',
          '<button class="thc-x" id="thcClose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>',
          '<div class="thc-head-row">',
            '<div class="thc-avatar"><img src="assets/img/chat-header.webp" alt="" /></div>',
            '<div>',
              '<div class="thc-title">Maui Booking Assistant</div>',
              '<div class="thc-sub">O thank Heaven 4 711 &bull; Kihei, Maui</div>',
            '</div>',
          '</div>',
        '</div>',

        '<div class="thc-msgs" id="thcMsgs">',
          '<div class="thc-welcome">',
            '<p>Aloha and welcome to <strong>O thank Heaven 4 711</strong>! 🌺</p>',
            '<p>I\'m here to answer any questions and help you book your Maui stay. What\'s your name?</p>',
          '</div>',
        '</div>',

        '<div class="thc-row">',
          '<textarea class="thc-in" id="thcIn" placeholder="Ask anything…" rows="1"></textarea>',
          '<button class="thc-send" id="thcSend" aria-label="Send"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
        '</div>',
      '</div>',
    ].join('');

    document.body.appendChild(el);

    id('thcBubble').addEventListener('click', toggle);
    id('thcClose').addEventListener('click', toggle);
    id('thcSend').addEventListener('click', function () { send(); });

    var inp = id('thcIn');
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    inp.addEventListener('input', resize);

    var sugs = document.querySelectorAll('.thc-sug');
    for (var i = 0; i < sugs.length; i++) {
      sugs[i].addEventListener('click', (function (btn) {
        return function () { send(btn.getAttribute('data-q')); };
      })(sugs[i]));
    }

    // Badge after 10 s if user hasn't opened
    setTimeout(function () {
      if (!isOpen) id('thcBadge').hidden = false;
    }, 10000);
  }

  // ─── Toggle panel ─────────────────────────────────────────────────────────

  function toggle() {
    isOpen = !isOpen;
    var panel = id('thcPanel');
    panel.classList.toggle('thc-panel--open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    id('thcBadge').hidden = true;
    if (isOpen) id('thcIn').focus();
  }

  // ─── Textarea auto-resize ─────────────────────────────────────────────────

  function resize() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  function send(preset) {
    var inp  = id('thcIn');
    var text = (preset || inp.value).trim();
    if (!text || isBusy) return;

    if (!preset) { inp.value = ''; inp.style.height = 'auto'; }

    // Remove welcome / suggestions on first send
    var welcome = document.querySelector('.thc-welcome');
    if (welcome) welcome.remove();

    addMsg('user', text);
    messages.push({ role: 'user', content: text });

    isBusy = true;
    showTyping();

    fetch(WORKER_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || 'Sorry, I ran into an issue. Please try again.';
        addMsg('bot', reply);
        messages.push({ role: 'assistant', content: reply });
        isBusy = false;
      })
      .catch(function () {
        hideTyping();
        addMsg('bot', 'Sorry, something went wrong. Please email us directly.');
        isBusy = false;
      });
  }

  // ─── Render a message ─────────────────────────────────────────────────────

  function addMsg(role, text) {
    var container = id('thcMsgs');
    var div = document.createElement('div');
    div.className = 'thc-msg thc-msg--' + role;

    // Basic formatting: bold, newlines, checkout links → button
    // IMPORTANT: run checkout detection on raw text BEFORE HTML escaping to avoid double-replacement
    var checkoutUrl = '';
    var cleaned = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]*checkout[^)]*)\)/gi, function(_, __, url) {
      checkoutUrl = url; return '\x00CHECKOUT\x00';
    }).replace(/(https:\/\/checkout\.stripe\.com\/[^\s)]+)/g, function(_, url) {
      checkoutUrl = url; return '\x00CHECKOUT\x00';
    });

    var html = cleaned
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\x00CHECKOUT\x00/g, checkoutUrl
        ? '<a href="' + checkoutUrl + '" target="_blank" rel="noopener" class="thc-book">Secure your dates &rarr;</a>'
        : '')
      .replace(/\n/g, '<br>');

    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ─── Typing indicator ─────────────────────────────────────────────────────

  function showTyping() {
    var container = id('thcMsgs');
    var div = document.createElement('div');
    div.id        = 'thcTyping';
    div.className = 'thc-msg thc-msg--bot thc-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = id('thcTyping');
    if (el) el.remove();
  }

  // ─── Util ─────────────────────────────────────────────────────────────────

  function id(s) { return document.getElementById(s); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
