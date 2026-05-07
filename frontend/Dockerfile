FROM node:18-slim

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000

# This matches the default "start" script in a React app
CMD ["npm", "start"]