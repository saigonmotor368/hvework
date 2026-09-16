import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    env: {
      JWT_SECRET: 'test_jwt_secret_for_vitest_runner_hve_2026_secure',
      VAPID_PUBLIC_KEY: 'BFjbMqiNCGRoHB7mOXPrABM0DeB_BHPaYi0NgPfW3kvd8OEL7XLQUIItTiuFUf7QJzNSYBLuvu0GPmAZ2tQXCak',
      VAPID_PRIVATE_KEY: 'lUsRzsbJW41b9FPkSDOgk1qmFlNUVBOHfzO0cWYc7Wg',
      VAPID_SUBJECT: 'mailto:admin@huyvoeducation.vn',
    },
  },
});
