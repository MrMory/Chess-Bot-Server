FROM node:16-alpine AS build

COPY . .
RUN npm install
RUN npm run build

WORKDIR ./client
RUN npm install
RUN npm run build

FROM node:16-alpine

COPY --from=build ./client/build ./client/build
COPY --from=build ./dist ./dist
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm install --only=prod

EXPOSE 5001

CMD ["npm", "start"]