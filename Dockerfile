FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates python3 make g++ libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

RUN npx playwright install --with-deps chromium \
    && chmod -R o+rx /ms-playwright

COPY . .
RUN npm run build \
    && cp -r public .next/standalone/public \
    && cp -r .next/static .next/standalone/.next/static \
    && chmod +x /app/entrypoint.sh \
    && mkdir -p /app/data /app/data/chrome-profile \
    && chown -R node:node /app

EXPOSE 4001

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]