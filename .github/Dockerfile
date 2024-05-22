FROM node:20

WORKDIR /code

COPY ./package.json ./package.json

RUN npm install --loglevel warn --unsafe-perm

COPY . ./

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]