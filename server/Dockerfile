# SPORTX API — production image
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY supabase ./supabase
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
# node:22-alpine has no wget/curl — use the built-in fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Listen immediately on 0.0.0.0:$PORT (Railway injects PORT). Migrations run after bind.
CMD ["node", "dist/src/server.js"]
