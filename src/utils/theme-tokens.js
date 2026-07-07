const THEME_STORAGE_KEY = 'painlocator_theme';

function getThemeToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getActiveTheme() {
  return document.body.classList.contains('theme-dark') ? 'dark' : 'light';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  const btn = document.getElementById('btnThemeToggle');
  if (btn) {
    btn.innerHTML = isDark
      ? '<i data-lucide="sun"></i> Light Mode'
      : '<i data-lucide="moon"></i> Dark Mode';
    if (window.lucide) lucide.createIcons();
  }
  if (typeof updateChartTheme === 'function') updateChartTheme();
}

function restoreSavedTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark') document.body.classList.add('theme-dark');
  else if (saved === 'light') document.body.classList.remove('theme-dark');
}

window.getThemeToken = getThemeToken;
window.getActiveTheme = getActiveTheme;
window.applyTheme = applyTheme;
window.restoreSavedTheme = restoreSavedTheme;
window.THEME_STORAGE_KEY = THEME_STORAGE_KEY;
