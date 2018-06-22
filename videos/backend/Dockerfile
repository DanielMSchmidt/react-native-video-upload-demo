FROM node:10

ADD package*.json ./
RUN npm install

ADD . .

EXPOSE 3000
ENTRYPOINT [ "npm", "start" ]