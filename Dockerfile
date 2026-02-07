FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache curl

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

