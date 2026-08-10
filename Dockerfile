FROM node:24-alpine AS build

WORKDIR /app

COPY ./package*.json ./
RUN npm ci

COPY . /app
RUN npm run build

# Strip dev dependencies so only runtime deps ship
RUN npm prune --omit=dev

# @zip.js/zip.js (via @cesium/engine) ships an encrypted-zip test fixture that
# image scanners flag as password-protected; not used at runtime.
RUN rm -rf node_modules/@zip.js/zip.js/tests


FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Run from dist so node-config resolves ./config relative to CWD
WORKDIR /app/dist

USER node
EXPOSE 8000

CMD ["node", "./index.js"]
