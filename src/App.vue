<template>
  <router-view />
</template>

<style>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #121214;
  color: #fff;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}

/* ponytail: X nativo do Chromium nos inputs type="search" (admin é Chrome-only); componente próprio só se precisar de Firefox/Safari.
   O botão vive num flexbox interno do shadow DOM do input — daí o flex-shrink. */
input[type="search"]::-webkit-search-cancel-button {
  -webkit-appearance: none;
  height: 14px;
  width: 14px;
  margin-left: 6px;
  flex-shrink: 0;
  cursor: pointer;
  background: rgba(255,255,255,0.45);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 6l12 12M18 6L6 18' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
}
input[type="search"]::-webkit-search-cancel-button:hover {
  background: #fff;
}
</style>
