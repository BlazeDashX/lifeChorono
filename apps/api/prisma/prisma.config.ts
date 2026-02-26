import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: "postgresql://neondb_owner:npg_kcE2bSsPK8or@ep-floral-king-a149zf0s-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require",
  },
  schema: 'prisma/schema.prisma',
});
