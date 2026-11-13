# Image de production : l'API sert aussi le formulaire (/) et le Studio (/studio/).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/form/package.json apps/form/
COPY apps/studio/package.json apps/studio/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache postgresql16-client
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
RUN npm ci --omit=dev -w @cree/api -w @cree/shared --include-workspace-root=false
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/apps/form/dist apps/form/dist
COPY --from=build /app/apps/studio/dist apps/studio/dist
COPY scripts scripts
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
