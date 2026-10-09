export interface Backend {
  readonly id: string;
  readonly name: string;
  readonly repository: string;
  readonly baseUrl: string;
  readonly proxyBaseUrl: string;
}

export const BACKENDS: readonly Backend[] = [
  {
    id: 'java',
    name: 'ERBAS Java / Spring Boot',
    repository: 'alxarafe/erbas',
    baseUrl: 'http://127.0.0.1:48080',
    proxyBaseUrl: '/backends/java',
  },
  {
    id: 'dotnet',
    name: 'Alxarafe.NET / ASP.NET Core',
    repository: 'alxarafe/alxarafe-dotnet',
    baseUrl: 'http://127.0.0.1:48081',
    proxyBaseUrl: '/backends/dotnet',
  },
];
