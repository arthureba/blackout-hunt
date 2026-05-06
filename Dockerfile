FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production
COPY backend ./backend
COPY frontend ./frontend
COPY schema.sql ./
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "server.js"]
