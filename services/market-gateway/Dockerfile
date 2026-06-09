# Market gateway — runs the Binance feed, persistence, indicator/alert engines
# and the WebSocket fan-out. Executed with tsx (TypeScript source, no build step).
FROM node:22-slim

WORKDIR /app

# Install workspace dependencies. Copy the manifests first for layer caching.
COPY package.json package-lock.json* ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY services/market-gateway/package.json services/market-gateway/

RUN npm install --omit=dev --workspaces --include-workspace-root=false \
    --no-audit --no-fund || npm install --no-audit --no-fund

# Copy sources for the packages this service needs.
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/db packages/db
COPY services/market-gateway services/market-gateway

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "run", "start", "--workspace", "services/market-gateway"]
