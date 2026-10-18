# Build the existing React/Vite frontend and bundled Express/tRPC server.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Install only runtime dependencies using the same pinned toolchain and lockfile.
FROM node:22-bookworm-slim AS production-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --prod --frozen-lockfile

# Production listener serves /dist/public and honors the platform-provided PORT.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 FILE_STORAGE_DIR=/app/data/uploads
COPY --from=production-deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
VOLUME ["/app/data/uploads"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000; fetch('http://127.0.0.1:'+port+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
