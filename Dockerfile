FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=dependencies --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/index.js"]
