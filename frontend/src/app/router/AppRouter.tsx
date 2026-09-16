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
import { ClientesPage } from "@/features/clientes/presentation/ClientesPage";
import { PrestamosPage } from "@/features/prestamos/presentation/PrestamosPage";
import { PrestamosListPage } from "@/features/prestamos/presentation/PrestamosListPage";
import { RegistrarPagoPage } from "@/features/pagos/presentation/RegistrarPagoPage";
import { SeguimientoCarteraPage } from "@/features/prestamos/presentation/SeguimientoCarteraPage";
import { AnalisisFinancieroClientePage } from "@/features/clientes/presentation/AnalisisFinancieroClientePage";
import { NuevoRefinanciamientoPage } from "@/features/refinanciamientos/presentation/NuevoRefinanciamientoPage";
import { CadenasRefinanciamientoPage } from "@/features/refinanciamientos/presentation/CadenasRefinanciamientoPage";
import { RefinanciamientosPage } from "@/features/refinanciamientos/presentation/RefinanciamientosPage";
import { RefinanciamientosReportePage } from "@/features/refinanciamientos/presentation/RefinanciamientosReportePage";
import { GestionIncobrablesPage } from "@/features/prestamos/presentation/GestionIncobrablesPage";
import { GestionAnulacionesPage } from "@/features/prestamos/presentation/GestionAnulacionesPage";
import { SaldadosPage } from "@/features/prestamos/presentation/SaldadosPage";
import { RentabilidadCanceladosPage } from "@/features/prestamos/presentation/RentabilidadCanceladosPage";
import { FlujoPrestamosPage } from "@/features/reportes/presentation/FlujoPrestamosPage";
import { AnalisisFinancieroPage } from "@/features/analisis-financiero/presentation/AnalisisFinancieroPage";
import { EstadisticasClientesPage } from "@/features/clientes/presentation/EstadisticasClientesPage";
import { ProyeccionGananciasPage } from "@/features/analisis-financiero/presentation/ProyeccionGananciasPage";

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
                <Route path="prestamos/gestion-incobrables" element={<GestionIncobrablesPage />} />
                <Route path="prestamos/gestion-anulaciones" element={<GestionAnulacionesPage />} />
                <Route path="finanzas/reportes/analisis-financiero" element={<AnalisisFinancieroPage />} />
                <Route path="prestamos/proyeccion" element={<ProyeccionGananciasPage />} />
              </Route>
              <Route path="configuracion/formas-de-pago" element={<FormasPagoPage />} />
              <Route path="configuracion/periodicidades" element={<PeriodicidadesPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/nuevo" element={<ClientesPage />} />
              <Route path="clientes/:id/editar" element={<ClientesPage />} />
              <Route path="clientes/analisis-financiero" element={<AnalisisFinancieroClientePage />} />
              <Route path="clientes/reporte" element={<EstadisticasClientesPage />} />
              <Route path="prestamos" element={<PrestamosListPage />} />
              <Route path="prestamos/saldados" element={<SaldadosPage />} />
              <Route path="prestamos/nuevo" element={<PrestamosPage />} />
              <Route path="prestamos/:id/editar" element={<PrestamosPage />} />
              <Route path="prestamos/seguimiento-cartera" element={<SeguimientoCarteraPage />} />
              <Route path="prestamos/reporte" element={<RentabilidadCanceladosPage />} />
              <Route path="finanzas/caja/cortes/rentabilidad-cancelados" element={<RentabilidadCanceladosPage />} />
              <Route path="finanzas/reportes/flujo-prestamos" element={<FlujoPrestamosPage />} />
              <Route path="pagos/registrar" element={<RegistrarPagoPage />} />
              <Route path="refinanciamientos" element={<RefinanciamientosPage />} />
              <Route path="refinanciamientos/nuevo" element={<NuevoRefinanciamientoPage />} />
              <Route path="refinanciamientos/cadenas" element={<CadenasRefinanciamientoPage />} />
              <Route path="refinanciamientos/reporte" element={<RefinanciamientosReportePage />} />
              <Route path="*" element={<PlaceholderPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
