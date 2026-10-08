# erbas-client

Planned shared Angular client for the Java and .NET ERBAS backends. This
repository currently contains no Angular application, Docker runtime or
end-to-end tests.

Host port **48082** and `ERBAS_CLIENT_PORT` (default 48082), mapped to planned
container port 80 on `127.0.0.1`, are reserved for **WEB-001**. They are not
implemented yet; Docker and the actual variable mapping belong to WEB-001.
See the [shared development-port convention](https://github.com/alxarafe/erbas-contract/blob/main/docs/development-ports.md).

The ecosystem comprises [the shared contract](https://github.com/alxarafe/erbas-contract),
[Java](https://github.com/alxarafe/erbas), [.NET](https://github.com/alxarafe/alxarafe-dotnet)
and this future client. Local ports are infrastructure conventions, not API behavior.
