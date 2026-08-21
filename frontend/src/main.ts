// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
// ZaloCRM is free software under the GNU Affero General Public License v3.0 (see LICENSE).
// Commercial (dual) licensing available: locnt@locnguyendata.com
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index';
import { vuetify } from './plugins/vuetify';
import './assets/tokens.css';
import './assets/main.css';
import './assets/rbac-page.css';
import './assets/hs-crm-theme.css'; // HS Holding redesign — load LAST để token/component HS thắng cascade (migration 2026-06-05)
import './assets/report-kit.css'; // Module Báo cáo — design system scoped .rpt-scope (2026-06-17)

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(vuetify);
app.mount('#app');

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    // onNeedRefresh: reload ngay khi có bản mới để tránh tab bị kẹt chạy
    // JS bundle cũ trong khi index.html/asset trên server đã đổi (gây lỗi
    // khó chịu như "mất phiên đăng nhập" do code cũ không khớp API mới).
    registerSW({
      immediate: true,
      onNeedRefresh() {
        window.location.reload();
      },
    });
  });
}
