FROM node:24-alpine AS build

WORKDIR /app

COPY ./package*.json ./
RUN npm ci

COPY . /app
RUN npm run build

# Strip dev dependencies so only runtime deps ship
RUN npm prune --omit=dev

# Drop Cesium assets the production runtime never loads: the 37MB unminified
# build (index.cjs picks Build/Cesium when NODE_ENV=production) and the 8.7MB
# ESM Source tree (unused under CommonJS require).
RUN rm -rf node_modules/cesium/Build/CesiumUnminified node_modules/cesium/Source


FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 8000

CMD ["node", "--max_old_space_size=512", "./dist/index.js"]
