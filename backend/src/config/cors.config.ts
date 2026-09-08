const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'];
const CORS_HEADERS = ['Authorization', 'Content-Type'];

export function getCorsOptions(environment: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = environment.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = environment.NODE_ENV === 'production';

  if (isProduction && !configuredOrigins?.length) {
    throw new Error('CORS_ORIGINS es obligatorio en producción.');
  }
  if (isProduction && configuredOrigins?.includes('*')) {
    throw new Error('CORS_ORIGINS no puede usar * en producción.');
  }

  return {
    origin: configuredOrigins?.length ? configuredOrigins : DEVELOPMENT_ORIGINS,
    methods: CORS_METHODS,
    allowedHeaders: CORS_HEADERS,
    credentials: false,
  };
}
