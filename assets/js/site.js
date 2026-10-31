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
