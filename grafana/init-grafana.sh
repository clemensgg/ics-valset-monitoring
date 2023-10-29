#!/bin/sh
envsubst < /etc/grafana/provisioning/datasources/postgres-template.yaml > /tmp/postgres.yaml
cp /tmp/postgres.yaml /etc/grafana/provisioning/datasources/postgres.yaml
exec /run.sh