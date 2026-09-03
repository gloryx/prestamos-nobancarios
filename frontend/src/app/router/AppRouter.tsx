import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { LoginPage } from "@/features/auth/presentation/LoginPage";
import { ProtectedRoute } from "@/features/auth/presentation/ProtectedRoute";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppLayout } from "@/shared/layouts/AppLayout";
import { PlaceholderPage } from "@/shared/components/PlaceholderPage";
import { UsuariosPage } from "@/features/usuarios/presentation/UsuariosPage";
import { FormasPagoPage } from "@/features/formas-pago/presentation/FormasPagoPage";
import { PeriodicidadesPage } from "@/features/periodicidades-pago/presentation/PeriodicidadesPage";
import { ConfiguracionFinancieraPage } from "@/features/configuracion-financiera/presentation/ConfiguracionFinancieraPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route element={<ProtectedRoute role="ADMINISTRADOR" />}>
                <Route path="configuracion/usuarios" element={<UsuariosPage />} />
                <Route path="configuracion/financiera" element={<ConfiguracionFinancieraPage />} />
              </Route>
              <Route path="configuracion/formas-de-pago" element={<FormasPagoPage />} />
              <Route path="configuracion/periodicidades" element={<PeriodicidadesPage />} />
              <Route path="*" element={<PlaceholderPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
