# dem-heights

This is a repo for extracting elevation info in a given location/position.

Data repo:

https://github.com/MapColonies/dem-heights-data/protobuf/v3

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

`Start`

```bash

npm start

```

Or:

```bash

docker container run --rm --name prometheus --net host -p 9090:9090 -v /temp/prometheus.yaml:/etc/prometheus/prometheus.yml prom/prometheus

http://localhost:9090

{job="server"} -> Execute

```

```bash

docker container run --rm --name grafana --net host -p 3000:3000 grafana/grafana-oss

```

`Start with telemetry`

```bash
TELEMETRY_TRACING_ENABLED=true TELEMETRY_TRACING_URL=http://localhost:4318/v1/traces TELEMETRY_METRICS_ENABLED=true TELEMETRY_METRICS_URL=http://localhost:4318/v1/metrics npm start
```

`Debug with telemetry`

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
```markdown
## Parameters

### configValues parameters

This description starts in a new line instead of the same line of description start tag. It does not have multiple lines.

| Name                                                   | Description                                                                                                                                                                                                                          | Value                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `configValues.deploymentAnnotations`                   | Annotations for configValues deployment                                                                                                                                                                                              | `{}`                                    |
| `configValues.autoscaling.vpa.enabled`                 | Enable VPA for pods (currently should be FALSE, TRUE still not tested)                                                                                                                                                               | `false`                                 |
| `configValues.autoscaling.vpa.annotations`             | Annotations for VPA resource                                                                                                                                                                                                         | `{}`                                    |
| `configValues.autoscaling.vpa.controlledResources`     | VPA List of resources that the vertical pod autoscaler can control. Defaults to cpu and memory                                                                                                                                       | `[]`                                    |
| `configValues.autoscaling.vpa.maxAllowed`              | VPA Max allowed resources for the pod                                                                                                                                                                                                | `{}`                                    |
| `configValues.autoscaling.vpa.minAllowed`              | VPA Min allowed resources for the pod                                                                                                                                                                                                | `{}`                                    |
| `configValues.autoscaling.vpa.updatePolicy.updateMode` | Autoscaling update policy                                                                                                                                                                                                            | `Auto`                                  |
| `configValues.autoscaling.hpa.enabled`                 | Enable HPA for pods                                                                                                                                                                                                                  | `false`                                 |
| `configValues.autoscaling.hpa.minReplicas`             | Minimum number of replicas                                                                                                                                                                                                           | `""`                                    |
| `configValues.autoscaling.hpa.maxReplicas`             | Maximum number of replicas                                                                                                                                                                                                           | `""`                                    |
| `configValues.autoscaling.hpa.targetCPU`               | Target CPU utilization percentage                                                                                                                                                                                                    | `""`                                    |
| `configValues.autoscaling.hpa.targetMemory`            | Target Memory utilization percentage                                                                                                                                                                                                 | `""`                                    |
| `configValues.replicaCount`                            | Number of replicas to deploy                                                                                                                                                                                                         | `1`                                     |
| `configValues.updateStrategy`                          | Update strategy of deploy. For more details see values.yaml                                                                                                                                                                          | `{}`                                    |
| `configValues.podLabels`                               | Extra labels for pods                                                                                                                                                                                                                | `{}`                                    |
| `configValues.podAnnotations.enabled`                  | Enable pod annotations                                                                                                                                                                                                               | `false`                                 |
| `configValues.podAnnotations.resetOnConfigChange`      | Relative annnotation for reset onConfig change                                                                                                                                                                                       | `true`                                  |
| `configValues.podAnnotations.annotations`              | Additional pod annotations                                                                                                                                                                                                           | `{}`                                    |
| `configValues.tracing.enabled`                         | Enable the export of tracing.                                                                                                                                                                                                        | `true`                                  |
| `configValues.tracing.url`                             | Traces collector url.                                                                                                                                                                                                                | `http://otel-collector:4318/v1/traces`  |
| `configValues.metrics.enabled`                         | Enable the export of Prometheus metrics.                                                                                                                                                                                             | `true`                                  |
| `configValues.metrics.url`                             | Metrics collector url.                                                                                                                                                                                                               | `http://otel-collector:4318/v1/metrics` |
| `configValues.metrics.prometheus.scrape`               | Metrics collector url, used in deployment annotations                                                                                                                                                                                | `true`                                  |
| `configValues.metrics.prometheus.port`                 | Metrics collector url port, used in deployment annotations                                                                                                                                                                           | `8000`                                  |
| `configValues.metrics.buckets`                         | Metrics buckets for configmap                                                                                                                                                                                                        | `[]`                                    |
| `configValues.automountServiceAccountToken`            | Mount Service Account token for pods                                                                                                                                                                                                 | `false`                                 |
| `configValues.hostAliases`                             | Pods host aliases                                                                                                                                                                                                                    | `[]`                                    |
| `configValues.affinity`                                | Affinity for pods assignment                                                                                                                                                                                                         | `{}`                                    |
| `configValues.podAffinityPreset`                       | Pod affinity preset. Ignored if `configValues.affinity` is set. Allowed values: `soft` or `hard`                                                                                                                                     | `""`                                    |
| `configValues.podAntiAffinityPreset`                   | Pod anti-affinity preset. Ignored if `configValues.affinity` is set. Allowed values: `soft` or `hard`                                                                                                                                | `soft`                                  |
| `configValues.nodeAffinityPreset`                      | Node afinity preset                                                                                                                                                                                                                  | `{}`                                    |
| `configValues.nodeSelector`                            | Node labels for pods assignment                                                                                                                                                                                                      | `{}`                                    |
| `configValues.tolerations`                             | Tolerations for pods assignment                                                                                                                                                                                                      | `[]`                                    |
| `configValues.priorityClassName`                       | pods' priorityClassName                                                                                                                                                                                                              | `""`                                    |
| `configValues.schedulerName`                           | Name of the k8s scheduler (other than default) for pods                                                                                                                                                                              | `""`                                    |
| `configValues.topologySpreadConstraints`               | Topology Spread Constraints for pod assignment spread across your cluster among failure-domains                                                                                                                                      | `[]`                                    |
| `configValues.podSecurityContext.enabled`              | Enable pods' Security Context                                                                                                                                                                                                        | `false`                                 |
| `configValues.podSecurityContext.fsGroupChangePolicy`  | Set filesystem group change policy for pods                                                                                                                                                                                          | `Always`                                |
| `configValues.podSecurityContext.sysctls`              | Set kernel settings using the sysctl interface for pods                                                                                                                                                                              | `[]`                                    |
| `configValues.podSecurityContext.supplementalGroups`   | Set filesystem extra groups for pods                                                                                                                                                                                                 | `[]`                                    |
| `configValues.podSecurityContext.fsGroup`              | Set fsGroup in pods' Security Context                                                                                                                                                                                                | `1001`                                  |
| `configValues.terminationGracePeriodSeconds`           | Seconds for pods need to terminate gracefully                                                                                                                                                                                        | `""`                                    |
| `configValues.initContainers`                          | Add additional init containers to the pods                                                                                                                                                                                           | `[]`                                    |
| `configValues.image.repository`                        | Image repository                                                                                                                                                                                                                     | `dem-heights`                           |
| `configValues.image.digest`                            | image digest in the way sha256:aa.... Please note this parameter, if set, will override the tag image tag (immutable tags are recommended)                                                                                           | `""`                                    |
| `configValues.image.pullPolicy`                        | image pull policy. Defaults to 'Always' if image tag is 'latest', else set to 'IfNotPresent'                                                                                                                                         | `IfNotPresent`                          |
| `configValues.image.pullSecrets`                       | image pull secrets. Secrets must be manually created in the namespace.                                                                                                                                                               | `[]`                                    |
| `configValues.image.debug`                             | Enable image debug mode                                                                                                                                                                                                              | `false`                                 |
| `configValues.containerSecurityContext.enabled`        | Enabled container' Security Context                                                                                                                                                                                                  | `false`                                 |
| `configValues.containerSecurityContext.runAsNonRoot`   | Set runAsNonRoot in container' Security Context                                                                                                                                                                                      | `true`                                  |
| `configValues.containerSecurityContext.runAsUser`      | Set runAsUser in container' Security Context                                                                                                                                                                                         | `1001`                                  |
| `configValues.command`                                 | Override default container command (useful when using custom images)                                                                                                                                                                 | `[]`                                    |
| `configValues.args`                                    | Override default container args (useful when using custom images)                                                                                                                                                                    | `[]`                                    |
| `configValues.extraEnvVars`                            | Array with extra environment variables to add to containers                                                                                                                                                                          | `[]`                                    |
| `configValues.extraEnvVarsCM`                          | Name of existing ConfigMap containing extra env vars for containers                                                                                                                                                                  | `""`                                    |
| `configValues.extraEnvVarsSecret`                      | Name of existing Secret containing extra env vars for containers                                                                                                                                                                     | `""`                                    |
| `configValues.resources`                               | Set container requests and limits for different resources like CPU or memory (essential for production workloads)                                                                                                                    | `{}`                                    |
| `configValues.resourcesPreset`                         | Set container resources according to one common preset (allowed values: none, nano, small, medium, large, xlarge, 2xlarge). This is ignored if configValues.resources is set (configValues.resources is recommended for production). | `nano`                                  |
| `configValues.containerPorts.http`                     | HTTP container port                                                                                                                                                                                                                  | `80`                                    |
| `configValues.containerPorts.https`                    | HTTPS container port                                                                                                                                                                                                                 | `443`                                   |
| `configValues.customLivenessProbe`                     | Custom livenessProbe that overrides the default one                                                                                                                                                                                  | `{}`                                    |
| `configValues.livenessProbe.enabled`                   | Enable livenessProbe on containers                                                                                                                                                                                                   | `true`                                  |
| `configValues.livenessProbe.initialDelaySeconds`       | Initial delay seconds for livenessProbe                                                                                                                                                                                              | `60`                                    |
| `configValues.livenessProbe.periodSeconds`             | Period seconds for livenessProbe                                                                                                                                                                                                     | `10`                                    |
| `configValues.livenessProbe.timeoutSeconds`            | Timeout seconds for livenessProbe                                                                                                                                                                                                    | `1`                                     |
| `configValues.livenessProbe.failureThreshold`          | Failure threshold for livenessProbe                                                                                                                                                                                                  | `3`                                     |
| `configValues.livenessProbe.successThreshold`          | Success threshold for livenessProbe                                                                                                                                                                                                  | `1`                                     |
| `configValues.customReadinessProbe`                    | Custom readinessProbe that overrides the default one                                                                                                                                                                                 | `{}`                                    |
| `configValues.readinessProbe.enabled`                  | Enable readinessProbe on containers                                                                                                                                                                                                  | `true`                                  |
| `configValues.readinessProbe.initialDelaySeconds`      | Initial delay seconds for readinessProbe                                                                                                                                                                                             | `60`                                    |
| `configValues.readinessProbe.periodSeconds`            | Period seconds for readinessProbe                                                                                                                                                                                                    | `10`                                    |
| `configValues.readinessProbe.timeoutSeconds`           | Timeout seconds for readinessProbe                                                                                                                                                                                                   | `1`                                     |
| `configValues.readinessProbe.failureThreshold`         | Failure threshold for readinessProbe                                                                                                                                                                                                 | `3`                                     |
| `configValues.readinessProbe.successThreshold`         | Success threshold for readinessProbe                                                                                                                                                                                                 | `1`                                     |
| `configValues.customStartupProbe`                      | Custom startupProbe that overrides the default one                                                                                                                                                                                   | `{}`                                    |
| `configValues.startupProbe.enabled`                    | Enable startupProbe on containers                                                                                                                                                                                                    | `true`                                  |
| `configValues.startupProbe.initialDelaySeconds`        | Initial delay seconds for startupProbe                                                                                                                                                                                               | `60`                                    |
| `configValues.startupProbe.periodSeconds`              | Period seconds for startupProbe                                                                                                                                                                                                      | `10`                                    |
| `configValues.startupProbe.timeoutSeconds`             | Timeout seconds for startupProbe                                                                                                                                                                                                     | `1`                                     |
| `configValues.startupProbe.failureThreshold`           | Failure threshold for startupProbe                                                                                                                                                                                                   | `3`                                     |
| `configValues.startupProbe.successThreshold`           | Success threshold for startupProbe                                                                                                                                                                                                   | `1`                                     |
| `configValues.lifecycleHooks`                          | for containers to automate configuration before or after startup                                                                                                                                                                     | `{}`                                    |
| `configValues.extraVolumes`                            | Optionally specify extra list of additional volumes for the pods                                                                                                                                                                     | `[]`                                    |
| `configValues.extraVolumeMounts`                       | Optionally specify extra list of additional volumeMounts for the containers                                                                                                                                                          | `[]`                                    |
| `configValues.sidecars`                                | Add additional sidecar containers to the pods                                                                                                                                                                                        | `[]`                                    |


...
``` 
