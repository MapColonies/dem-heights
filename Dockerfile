FROM node:20 as build

WORKDIR /app

COPY ./package*.json ./
RUN npm ci

COPY . /app
RUN npm run build

ENV NODE_ENV=production

COPY ./entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

RUN mkdir -p ./clonedProtoFolder && chown -R root ./clonedProtoFolder && chmod -R g=u ./clonedProtoFolder && chown -R node ./clonedProtoFolder
RUN mkdir -p ./dist/proto && chown -R root ./dist/proto && chmod -R g=u ./dist/proto && chown -R node ./dist/proto

USER node
EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "--max_old_space_size=512", "./dist/index.js"]