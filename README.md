# dem-heights

This is a repo for extracting elevation info in a given location/position.

Data repo:

https://github.com/MapColonies/dem-heights-data

## Run locally

Clone the project

```bash

git clone https://github.com/MapColonies/dem-heights.git

```

Go to project directory

```bash

cd dem-heights

```

Install dependencies

```bash

npm install

```
Install git hooks

```bash

npx husky install

```

Start the server

```bash

npm start

```

## Run via docker

Start container

```bash

docker-compose up -d

```

Get inside container

```bash

docker container exec -it dem-heights-container /bin/bash

```

See logs

```bash

docker container logs --follow dem-heights-container

```

Stop container

```bash

docker-compose down

```
