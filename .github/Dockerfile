FROM node:20

COPY build-artifacts /

WORKDIR /src

RUN ["npm", "install"]

ENTRYPOINT [ "npm", "run", "start" ]