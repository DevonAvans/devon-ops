FROM node:18

WORKDIR /app

COPY external-service ./external_service
COPY middleware ./middleware
COPY package.json ./
COPY rabbitmq.js ./

RUN mkdir -p /public/uploads
RUN npm i

EXPOSE 3003

CMD ["node", "external_service/index.js", "external-service"]