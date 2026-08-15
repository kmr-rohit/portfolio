# Module 1 — from process to container

Workbench is intentionally small: one standard-library Python HTTP process and
one Redis process on a Compose bridge. No Python packages hide the socket or
service-discovery boundary—the API implements the few RESP operations it needs.

Use the stable commands from the lab root:

```sh
make module-01-up
make module-01-verify
make module-01-break
make module-01-repair
make module-01-down
```

Useful observations while the healthy stack is running:

```sh
docker compose --project-name workbench-m01 --file modules/01-process-to-container/compose.yaml ps
docker compose --project-name workbench-m01 --file modules/01-process-to-container/compose.yaml logs api
docker inspect "$(docker compose --project-name workbench-m01 --file modules/01-process-to-container/compose.yaml ps -q api)"
curl --fail http://127.0.0.1:18080/healthz
curl --fail --json '{"text":"containers share a kernel"}' http://127.0.0.1:18080/documents
```

The Redis data is deliberately ephemeral in this first topology. Both root
filesystems are read-only; writable `/tmp` mounts are memory-backed and are
removed with the stack.
