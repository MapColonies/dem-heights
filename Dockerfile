FROM node:24-alpine AS build

WORKDIR /app

COPY ./package*.json ./
RUN npm ci

COPY . /app
RUN npm run build

# Strip dev dependencies so only runtime deps ship
RUN npm prune --omit=dev


FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 8000

CMD ["node", "--max_old_space_size=512", "./dist/index.js"]
