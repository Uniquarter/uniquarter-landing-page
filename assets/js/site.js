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
