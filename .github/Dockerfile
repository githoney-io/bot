FROM node:20

COPY build-artifacts /src

WORKDIR /src

RUN ["npm", "install"]

ENTRYPOINT [ "npm", "run", "start" ]