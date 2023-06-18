FROM node:18

WORKDIR /app

COPY api_gateway ./api_gateway
COPY middleware ./middleware
COPY package.json .

RUN npm i

EXPOSE 3000

CMD ["node", "api_gateway/index.js", "api_gateway"]