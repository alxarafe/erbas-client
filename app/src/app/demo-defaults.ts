export interface DemoDefaults {
  adminEmail: string;
  adminPassword: string;
  userEmail: string;
  userPassword: string;
}

export function parseDemoDefaults(text: string): DemoDefaults | null {
  if (/[\r\0]/.test(text)) return null;
  const names = [
    'ERBAS_DEMO_ADMIN_EMAIL',
    'ERBAS_DEMO_ADMIN_PASSWORD',
    'ERBAS_DEMO_USER_EMAIL',
    'ERBAS_DEMO_USER_PASSWORD',
  ];
  const values = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) return null;
    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (!names.includes(name) || values.has(name) || !value) return null;
    values.set(name, value);
  }
  if (values.size !== names.length || values.get(names[0]) === values.get(names[2])) return null;
  return {
    adminEmail: values.get(names[0])!,
    adminPassword: values.get(names[1])!,
    userEmail: values.get(names[2])!,
    userPassword: values.get(names[3])!,
  };
}
