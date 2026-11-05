(() => {
  let preference = "dark";
  try {
    const stored = window.localStorage.getItem("tandem-ads.theme-preference");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch {
    // Use the dark default when browser storage is unavailable.
  }

  let resolved = preference;
  if (preference === "system") {
    try {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      resolved = "dark";
    }
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolved === "light" ? "#F6F8FC" : "#090D16",
  );
})();
