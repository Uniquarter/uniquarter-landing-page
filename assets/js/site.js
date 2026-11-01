// Tab groups for the eight-stage explainer and the "Who it is for" tabs.
// Without JavaScript every panel stays visible, stacked, so nothing is lost.
// Arrow keys, Home and End move between tabs, following the ARIA tabs pattern.
function tabGroup(selector) {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!tabs.length) return;

  function select(index, focus) {
    tabs.forEach(function (tab, i) {
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      var on = i === index;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      select(i, false);
    });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    });
  });

  select(0, false);
}

tabGroup(".steps .step");
tabGroup(".tabs .tab");

// The header menu button, shown at narrow widths only. Choosing a link,
// pressing Escape or clicking outside the header closes the menu.
function navMenu() {
  var toggle = document.querySelector(".nav-toggle");
  if (!toggle) return;
  var menu = document.getElementById(toggle.getAttribute("aria-controls"));
  var header = toggle.closest(".site-header");

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    menu.classList.toggle("open", open);
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
    setOpen(false);
    toggle.focus();
  });
  document.addEventListener("click", function (e) {
    if (!header.contains(e.target)) setOpen(false);
  });
}

navMenu();

// The app screens carousel on phones. Each phone sits at an offset from the
// front: 0 is the front, -1 and 1 bleed off the screen edges. Offsets wrap
// round, so a phone pushed off one edge comes back in on the other. Phones
// are placed from a running position, so a drag moves them with the finger.
function phoneCarousel() {
  var root = document.querySelector(".carousel");
  if (!root) return;
  var track = root.querySelector(".carousel-track");
  var phones = Array.prototype.slice.call(root.querySelectorAll(".phone"));
  var dots = Array.prototype.slice.call(root.querySelectorAll(".carousel-dot"));
  var count = phones.length;
  var pos = 1;
  var anim = null;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  function offsetOf(i) {
    var o = (((i - pos) % count) + count) % count;
    return o >= count / 2 ? o - count : o;
  }

  // Phones sit 0.7 of a phone width apart, so the side ones tuck behind the front.
  function spacing() {
    return phones[0].offsetWidth * 0.7;
  }

  function place() {
    var width = root.clientWidth;
    var gap = spacing();
    phones.forEach(function (phone, i) {
      var o = offsetOf(i);
      var a = Math.abs(o);
      // Past one step out, push harder so the phone is fully off screen
      // before it wraps to the other side.
      var x = o * gap + Math.sign(o) * Math.max(0, a - 1) * width * 0.5;
      var scale = 1 - Math.min(a, 1.5) * 0.16;
      phone.style.transform = "translateX(" + x + "px) scale(" + scale + ")";
      phone.style.zIndex = String(10 - Math.round(a * 2));
      phone.setAttribute("aria-hidden", a < 0.5 ? "false" : "true");
    });
    var front = ((Math.round(pos) % count) + count) % count;
    dots.forEach(function (dot, i) {
      dot.setAttribute("aria-current", i === front ? "true" : "false");
    });
  }

  function goTo(target) {
    cancelAnimationFrame(anim);
    if (still.matches) {
      pos = target;
      place();
      return;
    }
    var from = pos;
    var start = null;
    function step(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / 350);
      pos = from + (target - from) * (1 - Math.pow(1 - t, 3));
      place();
      if (t < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }

  var startX = null;
  var startPos = 0;
  var moved = false;

  track.addEventListener("pointerdown", function (e) {
    cancelAnimationFrame(anim);
    startX = e.clientX;
    startPos = pos;
    moved = false;
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    pos = startPos - dx / spacing();
    place();
  });
  function release(e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    startX = null;
    if (moved) {
      // A short flick is enough to move one phone along.
      var target = Math.abs(dx) > 40 ? Math.round(startPos) - Math.sign(dx) : Math.round(startPos);
      if (Math.abs(pos - target) > 1) target = Math.round(pos);
      goTo(target);
      return;
    }
    // A tap on a side phone brings it to the front.
    var hit = document.elementsFromPoint(e.clientX, e.clientY);
    var phone = phones.filter(function (p) { return hit.indexOf(p) !== -1; })
      .sort(function (a, b) { return b.style.zIndex - a.style.zIndex; })[0];
    goTo(Math.round(pos) + (phone ? Math.round(offsetOf(phones.indexOf(phone))) : 0));
  }
  track.addEventListener("pointerup", release);
  // The browser took the touch for a page scroll: settle back where we were.
  track.addEventListener("pointercancel", function () {
    if (startX === null) return;
    startX = null;
    goTo(Math.round(startPos));
  });

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      goTo(Math.round(pos) + Math.round(offsetOf(i)));
    });
  });
  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") goTo(Math.round(pos) + 1);
    else if (e.key === "ArrowLeft") goTo(Math.round(pos) - 1);
    else return;
    e.preventDefault();
  });

  place();
  window.addEventListener("resize", place);
}

phoneCarousel();

// The three "What UniQuarter is" cards. In a row they hold the height of the
// tallest closed card, so opening one grows that card alone instead of
// stretching the other two. Stacked, each card keeps its own height. Without
// JavaScript the cards stretch together, so they still match when closed.
function holdCardHeights() {
  var cards = Array.prototype.slice.call(document.querySelectorAll(".grid3 > .xcard"));
  if (cards.length < 2) return;
  var grid = cards[0].parentNode;
  var inRow = cards[0].offsetTop === cards[1].offsetTop;
  grid.classList.toggle("held", inRow);
  if (!inRow) return;

  var tallest = 0;
  cards.forEach(function (card) {
    var border = card.offsetHeight - card.clientHeight;
    tallest = Math.max(tallest, card.querySelector("summary").offsetHeight + border);
  });
  grid.style.setProperty("--card-h", tallest + "px");
}

var holdTimer;
function queueHoldCardHeights() {
  cancelAnimationFrame(holdTimer);
  holdTimer = requestAnimationFrame(holdCardHeights);
}

holdCardHeights();
window.addEventListener("resize", queueHoldCardHeights);
window.addEventListener("load", queueHoldCardHeights);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueHoldCardHeights);

// The sign-up form. It needs JavaScript, as does the Turnstile bot check, so it
// stays hidden until this finds both settings on the form filled in. Without
// JavaScript, a noscript note gives Alex's address instead. The checks here
// mirror worker/src/validate.js, which has the final say.
var SIGNUP_NAME_REFUSED = /[<>@\\{}[\]]|:\/\/|www\.|\.(com|net|org|nz|io|co|ru|xyz)\b/i;
var SIGNUP_EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]{2,}$/;

// Email domains people commonly mistype, including the three institutions'
// student and staff addresses. An address close to one of these, but not on
// the list, gets a "Did you mean" prompt. It never blocks the form.
var SIGNUP_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "icloud.com", "me.com", "protonmail.com", "proton.me",
  "xtra.co.nz", "outlook.co.nz", "hotmail.co.nz", "live.co.nz", "yahoo.co.nz",
  "uclive.ac.nz", "canterbury.ac.nz", "lincolnuni.ac.nz", "lincoln.ac.nz", "ara.ac.nz"
];

// The number of single-letter changes, including swapping two neighbours,
// that turn one word into the other.
function editDistance(a, b) {
  var d = [];
  for (var i = 0; i <= a.length; i++) {
    d[i] = [i];
    for (var j = 1; j <= b.length; j++) {
      if (i === 0) { d[i][j] = j; continue; }
      var cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Short domains allow one slip and longer ones two, so a real but unusual
// domain is rarely second-guessed.
function suggestEmail(email) {
  var at = email.lastIndexOf("@");
  if (at < 1) return "";
  var domain = email.slice(at + 1).toLowerCase();
  if (!domain || SIGNUP_DOMAINS.indexOf(domain) !== -1) return "";
  var best = "";
  var bestDistance = Infinity;
  SIGNUP_DOMAINS.forEach(function (known) {
    var distance = editDistance(domain, known);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    }
  });
  return bestDistance <= (domain.length < 8 ? 1 : 2) ? email.slice(0, at + 1) + best : "";
}

function signupForm() {
  var form = document.getElementById("signup");
  if (!form) return;
  var endpoint = form.getAttribute("data-endpoint");
  var siteKey = form.getAttribute("data-sitekey");
  if (!endpoint || !siteKey || siteKey.indexOf("REPLACE") === 0) return;

  var summary = document.getElementById("signup-errors");
  var status = document.getElementById("signup-status");
  var done = document.getElementById("signup-done");
  var button = form.querySelector("button[type=submit]");
  var institutionField = document.getElementById("signup-institution-field");
  var radios = Array.prototype.slice.call(form.querySelectorAll("input[name=role]"));
  var widget = null;
  var turnstileToken = "";
  var busy = false;

  var fields = {
    firstName: { focus: form.elements.firstName, error: document.getElementById("signup-name-error"), marked: [form.elements.firstName] },
    email: { focus: form.elements.email, error: document.getElementById("signup-email-error"), marked: [form.elements.email] },
    role: { focus: radios[0], error: document.getElementById("signup-role-error"), marked: radios }
  };

  var MESSAGES = {
    rate_limited: "Too many tries from your connection. Wait a minute, then try again.",
    email_limited: "We sent a link to that address less than a minute ago. Check your inbox and junk folder before trying again.",
    challenge: "We could not confirm you are a person. Try again, or email alex.moyse@uniquarter.co.nz instead.",
    network: "We could not send your details. Check your connection and try again.",
    other: "Something went wrong on our side. Try again in a few minutes, or email alex.moyse@uniquarter.co.nz instead."
  };

  // Institution only applies to students and institutions.
  function showInstitution() {
    var role = form.elements.role.value;
    var show = role === "student" || role === "institution";
    institutionField.hidden = !show;
    if (!show) form.elements.institution.value = "";
  }

  function check() {
    var bad = [];
    var name = form.elements.firstName.value.replace(/\s+/g, " ").trim();
    if (!name || name.length > 50 || SIGNUP_NAME_REFUSED.test(name)) bad.push("firstName");
    var email = form.elements.email.value.trim();
    if (!email || email.length > 254 || !SIGNUP_EMAIL.test(email)) bad.push("email");
    if (!form.elements.role.value) bad.push("role");
    return bad;
  }

  // Marks each field and lists the problems in a summary at the top, whose
  // links move focus to the field concerned. Focus moves to the summary only
  // on submit, not while errors clear as the visitor fixes them.
  var shown = [];
  function showErrors(bad, quiet) {
    shown = bad;
    var list = summary.querySelector("ul");
    list.textContent = "";
    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      var on = bad.indexOf(key) !== -1;
      field.error.hidden = !on;
      field.error.closest(".field").classList.toggle("has-error", on);
      field.marked.forEach(function (input) {
        if (on) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      });
      if (!on) return;
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + field.focus.id;
      link.textContent = field.error.textContent;
      link.addEventListener("click", function (e) {
        e.preventDefault();
        field.focus.focus();
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    summary.hidden = bad.length === 0;
    if (bad.length && !quiet) summary.focus();
  }

  function ready() {
    busy = false;
    button.disabled = false;
    turnstileToken = "";
    if (widget !== null) window.turnstile.reset(widget);
  }

  function finish(email) {
    form.hidden = true;
    document.getElementById("signup-done-email").textContent = email;
    done.hidden = false;
    done.focus();
  }

  window.uqTurnstileReady = function () {
    widget = window.turnstile.render("#signup-challenge", {
      sitekey: siteKey,
      appearance: "interaction-only",
      size: "flexible",
      theme: "light",
      "refresh-expired": "auto",
      callback: function (token) { turnstileToken = token; },
      "expired-callback": function () { turnstileToken = ""; }
    });
  };
  var script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=uqTurnstileReady";
  script.async = true;
  document.head.appendChild(script);

  // "Did you mean name@gmail.com?" under the email box, with a button that
  // swaps the suggestion in. Shown when the visitor leaves the box.
  var suggestBox = document.getElementById("signup-email-suggest");
  function showSuggestion() {
    var suggestion = suggestEmail(form.elements.email.value.trim());
    suggestBox.textContent = "";
    if (!suggestion) return;
    var swap = document.createElement("button");
    swap.type = "button";
    swap.textContent = suggestion;
    swap.addEventListener("click", function () {
      form.elements.email.value = suggestion;
      suggestBox.textContent = "";
      form.elements.email.focus();
    });
    suggestBox.appendChild(document.createTextNode("Did you mean "));
    suggestBox.appendChild(swap);
    suggestBox.appendChild(document.createTextNode("?"));
  }

  // A fixed field loses its error straight away. Fields not yet flagged are
  // left alone until the next submit.
  function clearFixed() {
    if (!shown.length) return;
    var still = check();
    showErrors(shown.filter(function (key) { return still.indexOf(key) !== -1; }), true);
  }

  form.addEventListener("change", function (e) {
    if (e.target.name === "role") showInstitution();
    if (e.target.name === "email") showSuggestion();
    clearFixed();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var bad = check();
    showErrors(bad);
    status.textContent = "";
    if (bad.length) return;
    if (!turnstileToken) {
      status.textContent = "Still checking you are a person. Try again in a moment.";
      return;
    }

    var email = form.elements.email.value.trim();
    busy = true;
    button.disabled = true;
    status.textContent = "Sending…";
    fetch(endpoint + "/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.elements.firstName.value,
        email: email,
        role: form.elements.role.value,
        institution: form.elements.institution.value,
        website: form.elements.website.value,
        turnstileToken: turnstileToken
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (reply) {
        if (reply.status === 202) {
          status.textContent = "";
          finish(email);
          return;
        }
        if (reply.body.error === "invalid" && reply.body.fields) {
          status.textContent = "";
          showErrors(reply.body.fields);
        } else {
          status.textContent = MESSAGES[reply.body.error] || MESSAGES.other;
        }
        ready();
      })
      .catch(function () {
        status.textContent = MESSAGES.network;
        ready();
      });
  });

  showInstitution();
  form.classList.add("signup-ready");
}

signupForm();

// The confirm page. The token arrives after the # in the link, so it never
// reaches the web server's logs. It is read once, then cleared from the
// address bar. A button, not the link itself, confirms, so email
// scanners that open links can't confirm on someone's behalf.
function confirmSignup() {
  var root = document.getElementById("confirm");
  if (!root) return;
  var endpoint = root.getAttribute("data-endpoint");
  var states = Array.prototype.slice.call(root.querySelectorAll("[data-state]"));
  var button = document.getElementById("confirm-button");
  var token = location.hash.slice(1);
  if (token) history.replaceState(null, "", location.pathname + location.search);

  function show(name) {
    states.forEach(function (el) {
      el.hidden = el.getAttribute("data-state") !== name;
    });
    var heading = root.querySelector('[data-state="' + name + '"] h1');
    if (heading && name !== "ready") heading.focus();
  }

  if (!/^[A-Za-z0-9_-]{40,2048}$/.test(token)) {
    show("invalid");
    return;
  }
  show("ready");

  var OUTCOMES = { 200: "done", 409: "used", 410: "expired", 400: "invalid" };
  button.addEventListener("click", function () {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Confirming…";
    fetch(endpoint + "/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token })
    })
      .then(function (res) {
        show(OUTCOMES[res.status] || "error");
      })
      .catch(function () {
        show("error");
      })
      .then(function () {
        button.disabled = false;
        button.textContent = "Confirm my interest";
      });
  });

  // From the error state the visitor can try again with the same token.
  var retry = document.getElementById("confirm-retry");
  if (retry) retry.addEventListener("click", function () {
    show("ready");
    button.focus();
  });
}

confirmSignup();
