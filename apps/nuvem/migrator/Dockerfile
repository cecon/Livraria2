FROM node:22-alpine

ARG SUPABASE_CLI_VERSION=2.110.0

RUN apk add --no-cache bash coreutils postgresql-client \
  && npm install -g supabase@${SUPABASE_CLI_VERSION}

WORKDIR /workspace
COPY apps/nuvem/migrations ./migrations
COPY apps/nuvem/migrator/run-migrations.sh ./run-migrations.sh

RUN chmod +x ./run-migrations.sh

CMD ["./run-migrations.sh"]
