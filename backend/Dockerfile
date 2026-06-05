# PATH: quiz-platform/backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/quiz.db
EXPOSE 5000
CMD ["node", "server.js"]
