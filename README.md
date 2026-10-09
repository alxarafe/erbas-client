# ERBAS Client

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Java CI](https://github.com/alxarafe/erbas/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alxarafe/erbas/actions/workflows/ci.yml)
[![.NET CI / shared Bruno](https://github.com/alxarafe/alxarafe-dotnet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alxarafe/alxarafe-dotnet/actions/workflows/ci.yml)

Planned shared Angular client for the Java and .NET ERBAS backends. This
repository currently contains no Angular application, Docker runtime or
end-to-end tests.

The backend badges link to their own workflows; they do not verify this client.
.NET CI includes shared Bruno; Java CI currently covers its build and native
checks. There is no client build workflow yet.

Client implementation and Docker networking belong to **WEB-001**. See the
[shared development-port convention](https://github.com/alxarafe/erbas-contract/blob/main/docs/development-ports.md).

The ecosystem comprises [the shared contract](https://github.com/alxarafe/erbas-contract),
[Java](https://github.com/alxarafe/erbas), [.NET](https://github.com/alxarafe/alxarafe-dotnet)
and this future client. Local ports are infrastructure conventions, not API behavior.

## License

Copyright (c) 2026 Alxarafe. Licensed under [Apache-2.0](LICENSE).
