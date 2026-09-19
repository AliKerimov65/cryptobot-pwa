# CryptoBot PWA — зеркало конвейера

Браузерное paper-зеркало Android-приложения CryptoBot: живой Bybit WebSocket
(публичный канал `wss://stream.bybit.com/v5/public/linear`), paper-симуляция
IHG-конвейера (логика R188–R190), 6 разделов, локаль RU. Торговля — только
виртуальная, ключи API не используются.

**Адрес сайта:** https://alikerimov65.github.io/cryptobot-pwa/

## Как устроен деплой

- Пуш в `main` запускает GitHub Actions (`.github/workflows/deploy.yml`):
  `npm install` → `npm run build:gh` (Vite с `--base=/cryptobot-pwa/`) →
  `index.html` копируется в `404.html` (SPA-роутинг на Pages) → каталог
  `dist/` публикуется в ветку `gh-pages` (peaceiris/actions-gh-pages).
  GitHub Pages раздаёт сайт из ветки `gh-pages`.
- Иконки — SVG (`public/icons/icon.svg`): репозиторий выгружен текстовым
  инструментом, бинарные PNG не включались; в `manifest.webmanifest`,
  `index.html` и `sw.js` прописан SVG.
- `package-lock.json` намеренно не выгружен — Actions ставит зависимости
  через `npm install` (не `npm ci`).

## Локальный запуск

```bash
npm install
npm run dev
```

Первоисточник — каталог `/mnt/agents/output/app` (зеркало Android-проекта
CryptoBotApp). Версия PWA: v1.
