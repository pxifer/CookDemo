FROM node:24-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY shared ./shared
COPY server ./server
COPY scripts/generate-validation.ts ./scripts/generate-validation.ts
COPY tsconfig.json vite.config.ts ./
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS runtime
WORKDIR /app
# tsx remains required by the current TypeScript server startup.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/build/web ./build/web
COPY scripts/database.ts ./scripts/database.ts
ENV NODE_ENV=production APP_ENV=staging HOST=0.0.0.0 PORT=8080 LOCAL_TEST_FEATURES=0 CONTENT_SOURCE=pending
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/main.ts"]
