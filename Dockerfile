FROM node:24.19.0-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production
# __AUTOATENDE_VOICE_BACKEND_PHASE4B1__
RUN apk add --no-cache curl ffmpeg

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

