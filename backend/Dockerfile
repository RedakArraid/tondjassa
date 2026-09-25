FROM node:24-alpine AS base
RUN apk add --no-cache openssl wget netcat-openbsd postgresql16-client bash
WORKDIR /app
FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx --no-install prisma generate
COPY src ./src
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev
FROM base AS runner
ENV NODE_ENV=production PORT=4002
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs
COPY --from=builder --chown=nodejs:nodejs /app /app
RUN chmod +x /app/scripts/*.sh && mkdir -p /app/uploads /app/logs /app/tmp && chown -R nodejs:nodejs /app
USER nodejs
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD wget -q --spider http://localhost:4002/health/ready || exit 1
EXPOSE 4002
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "src/app.js"]
