# Hardening assignment

`Dockerfile.insecure` is intentionally not wired into Compose. Copy it beside
the module `app/` directory, identify each violated container contract, then
produce a hardened variant. Your evidence should compare image metadata and
size, prove uid/gid 10001, exercise a read-only root filesystem, show both
`linux/amd64` and `linux/arm64` index descriptors, call `/healthz`, and complete
an in-flight `/slow` request while the process receives `SIGTERM`.

The runnable lab Dockerfile is single-stage on purpose: the application has no
compiler or third-party dependencies to discard. Use a multi-stage build when a
real build stage produces artifacts that should not enter the runtime image;
adding an empty stage here would teach ceremony rather than layer hygiene.
