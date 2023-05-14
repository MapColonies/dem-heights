#!/bin/sh

echo cloning from repo $PROTO_FILE_URL

PROTO_FILE_PATH=/protobuf/$SERVICE_VERSION/posWithHeight.proto
PROTO_APP_PATH=/app/dist/proto
CLONE_FOLDER_PATH=/clonedProtoFolder

mkdir /$CLONE_FOLDER_PATH
exec "chown ./$CLONE_FOLDER_PATH node:node"

cd $CLONE_FOLDER_PATH

git clone $PROTO_FILE_URL .

echo "Finish clone..."

\cp $PROTO_FILE_PATH $PROTO_APP_PATH
echo "Finished Copy"

cd /app
echo "Running start command"
exec "$@"