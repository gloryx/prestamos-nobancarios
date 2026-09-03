# Authentication and administrator bootstrap

The API uses short-lived JWT access tokens. `JWT_SECRET` and `JWT_EXPIRES_IN` are required environment variables; the application fails during configuration when either is missing or empty. No public registration endpoint exists.

All controllers are protected by the global `JwtAuthGuard` except `POST /auth/login`. `JwtStrategy` loads the current user from `usuario` on every request and rejects missing or inactive users. `RolesGuard` reads only `request.user.rol` and the `@Roles` metadata.

The existing `scrypt:<salt>:<hex digest>` password format is verified for backward compatibility. New users and password changes use bcrypt. General user updates never modify the password hash. Responses deliberately project out `passwordHash`.

## Safe first administrator provisioning

The application does not create a fixed administrator or a default credential. If the database has no administrator, provision one through the operator-controlled database procedure already used for initial data:

1. Generate a bcrypt hash on the trusted deployment host, supplying the password through a protected prompt or secret manager (never a command-line argument, source file, log, or committed `.env`).
2. Insert or update the intended existing `usuario` row with that hash, `rol = 'ADMINISTRADOR'`, and `activo = true` using a parameterized database client and the normal database credentials.
3. Remove the generated hash from temporary storage and log only the provisioning event, not the credential or hash.
4. Sign in through `POST /auth/login`, then perform future user administration through the protected API.

This procedure reuses the existing `usuario` table and does not create parallel users, roles, or sessions.
