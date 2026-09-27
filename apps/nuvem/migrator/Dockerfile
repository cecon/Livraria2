FROM postgres:16-alpine
RUN apk add --no-cache bash coreutils
WORKDIR /workspace
COPY apps/nuvem/migrations ./migrations
COPY apps/nuvem/api/sql ./api-migrations
COPY apps/nuvem/migrator/run-migrations.sh ./run-migrations.sh
RUN chmod +x ./run-migrations.sh
CMD ["./run-migrations.sh"]
