# Single-service image: Fastify serves the API, the WebSocket gateway and the
# built SPA from one origin. Run migrations separately (see README) — this
# container does not migrate on boot, so a crash-looping deploy can't half-apply
# a schema change.

FROM node:22-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/prisma ./apps/server/prisma

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./

EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=apps/server"]
