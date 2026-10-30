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
