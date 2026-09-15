#!/bin/sh
set -e

echo "==> Applying database migrations..."
node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
echo "==> Migrations applied."

echo "==> Starting application on :${PORT:-3000}"
exec node server.js
