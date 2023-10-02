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

Prometheus:

```bash

docker container run --rm --name prometheus --net host -p 9090:9090 -v /temp/prometheus.yaml:/etc/prometheus/prometheus.yml prom/prometheus

http://localhost:9090

{job="server"} -> Execute

```

Grafana:

```bash

docker container run --rm --name grafana --net host -p 3000:3000 grafana/grafana-oss

```

Start

```bash

npm start

```

Or:

Start with telemetry enabled

```bash
TELEMETRY_TRACING_ENABLED=true TELEMETRY_TRACING_URL=http://localhost:4318/v1/traces TELEMETRY_METRICS_ENABLED=true TELEMETRY_METRICS_URL=http://localhost:4318/v1/metrics npm start
```

Or:

Debug with telemetry enabled

```bash
cd dist

TELEMETRY_TRACING_ENABLED=true TELEMETRY_TRACING_URL=http://localhost:4318/v1/traces TELEMETRY_METRICS_ENABLED=true TELEMETRY_METRICS_URL=http://localhost:4318/v1/metrics node --inspect index.js
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
