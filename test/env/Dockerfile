FROM mhart/alpine-node

RUN apk update && apk add git

RUN mkdir /tmp/testenv

WORKDIR /tmp/testenv

COPY lib/ ./lib
COPY test/ ./test
COPY package.json ./

RUN npm install

CMD npm run test:run
