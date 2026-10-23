const { defineConfig, devices } = require('@playwright/test');

const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@pago-vecinal.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2ePass123!';
const databaseName = process.env.E2E_DATABASE_NAME || 'pago_vecinal_e2e';
const mongodbUrl = process.env.E2E_MONGODB_URL || 'mongodb://127.0.0.1:27017';
const backendPort = process.env.E2E_BACKEND_PORT || '8100';
const frontendPort = process.env.E2E_FRONTEND_PORT || '3100';
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'cd ../backend && if [ -x .venv/bin/python ]; then exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port ' +
        backendPort +
        '; else exec python -m uvicorn app.main:app --host 127.0.0.1 --port ' +
        backendPort +
        '; fi',
      url: `${backendUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        MONGODB_URL: mongodbUrl,
        DATABASE_NAME: databaseName,
        SECRET_KEY: process.env.E2E_SECRET_KEY || 'e2e-secret-key',
        INITIAL_ADMIN_EMAIL: adminEmail,
        INITIAL_ADMIN_PASSWORD: adminPassword,
        INITIAL_ADMIN_NAME: 'E2E Admin',
        CLOUDINARY_CLOUD_NAME: 'e2e-cloud',
        CLOUDINARY_API_KEY: 'e2e-key',
        CLOUDINARY_API_SECRET: 'e2e-secret',
        CORS_ORIGINS: JSON.stringify([frontendUrl, `http://localhost:${frontendPort}`]),
      },
    },
    {
      command: 'npm start',
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        BROWSER: 'none',
        PORT: frontendPort,
        REACT_APP_API_URL: backendUrl,
        CI: 'false',
      },
    },
  ],
});
