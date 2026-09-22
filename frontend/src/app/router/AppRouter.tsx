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
import { FormaPagoReportPage } from "@/features/reportes/presentation/FormaPagoReportPage";
import { AnalisisFinancieroPage } from "@/features/analisis-financiero/presentation/AnalisisFinancieroPage";
import { EstadisticasClientesPage } from "@/features/clientes/presentation/EstadisticasClientesPage";
import { ProyeccionGananciasPage } from "@/features/analisis-financiero/presentation/ProyeccionGananciasPage";
import { CobrosDelDiaPage } from "@/features/pagos/presentation/CobrosDelDiaPage";
import { HistorialPagosPage } from "@/features/pagos/presentation/HistorialPagosPage";
import { DesempenoCobradoresPage } from "@/features/reportes/presentation/DesempenoCobradoresPage";
import { MovimientosCajaPage } from "@/features/movimientos-caja/presentation/MovimientosCajaPage";
import { EstadoCajaPage } from "@/features/movimientos-caja/presentation/EstadoCajaPage";
import { OperacionesCajaPage } from "@/features/movimientos-caja/presentation/OperacionesCajaPage";
import { CierresMensualesPage } from "@/features/cierres-mensuales/presentation/CierresMensualesPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<ProtectedRoute role="ADMINISTRADOR"><DashboardPage /></ProtectedRoute>} />
              <Route element={<ProtectedRoute role="ADMINISTRADOR" />}>
                <Route path="configuracion/usuarios" element={<UsuariosPage />} />
                <Route path="configuracion/financiera" element={<ConfiguracionFinancieraPage />} />
                <Route path="prestamos/gestion-incobrables" element={<GestionIncobrablesPage />} />
                <Route path="prestamos/gestion-anulaciones" element={<GestionAnulacionesPage />} />
                <Route path="finanzas/reportes/analisis-financiero" element={<AnalisisFinancieroPage />} />
                <Route path="prestamos/proyeccion" element={<ProyeccionGananciasPage />} />
                <Route path="finanzas/caja/movimientos" element={<MovimientosCajaPage />} />
                <Route path="finanzas/caja/estado" element={<EstadoCajaPage />} />
                <Route path="finanzas/caja/operaciones" element={<OperacionesCajaPage />} />
                <Route path="finanzas/cierres" element={<CierresMensualesPage />} />
              </Route>
              <Route path="configuracion/formas-de-pago" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><FormasPagoPage /></ProtectedRoute>} />
              <Route path="configuracion/periodicidades" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><PeriodicidadesPage /></ProtectedRoute>} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/nuevo" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><ClientesPage /></ProtectedRoute>} />
              <Route path="clientes/:id/editar" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><ClientesPage /></ProtectedRoute>} />
              <Route path="clientes/analisis-financiero" element={<ProtectedRoute role="ADMINISTRADOR"><AnalisisFinancieroClientePage /></ProtectedRoute>} />
              <Route path="clientes/reporte" element={<ProtectedRoute role="ADMINISTRADOR"><EstadisticasClientesPage /></ProtectedRoute>} />
              <Route path="prestamos" element={<PrestamosListPage />} />
              <Route path="prestamos/saldados" element={<SaldadosPage />} />
              <Route path="prestamos/nuevo" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><PrestamosPage /></ProtectedRoute>} />
              <Route path="prestamos/:id/editar" element={<ProtectedRoute role={["ADMINISTRADOR", "VENDEDOR"]}><PrestamosPage /></ProtectedRoute>} />
              <Route path="prestamos/seguimiento-cartera" element={<ProtectedRoute role="ADMINISTRADOR"><SeguimientoCarteraPage /></ProtectedRoute>} />
              <Route path="prestamos/reporte" element={<ProtectedRoute role="ADMINISTRADOR"><RentabilidadCanceladosPage /></ProtectedRoute>} />
              <Route path="finanzas/caja/cortes/rentabilidad-cancelados" element={<ProtectedRoute role="ADMINISTRADOR"><RentabilidadCanceladosPage /></ProtectedRoute>} />
              <Route path="finanzas/reportes/flujo-prestamos" element={<ProtectedRoute role="ADMINISTRADOR"><FlujoPrestamosPage /></ProtectedRoute>} />
              <Route path="finanzas/reportes/forma-pago" element={<ProtectedRoute role="ADMINISTRADOR"><FormaPagoReportPage /></ProtectedRoute>} />
              <Route path="pagos/registrar" element={<RegistrarPagoPage />} />
              <Route path="pagos" element={<CobrosDelDiaPage />} />
              <Route path="pagos/historial" element={<ProtectedRoute role="ADMINISTRADOR"><HistorialPagosPage /></ProtectedRoute>} />
              <Route path="reportes/pagos/desempeno-cobradores" element={<ProtectedRoute role="ADMINISTRADOR"><DesempenoCobradoresPage /></ProtectedRoute>} />
              <Route path="refinanciamientos" element={<RefinanciamientosPage />} />
              <Route path="refinanciamientos/nuevo" element={<NuevoRefinanciamientoPage />} />
              <Route path="refinanciamientos/cadenas" element={<CadenasRefinanciamientoPage />} />
              <Route path="refinanciamientos/reporte" element={<ProtectedRoute role="ADMINISTRADOR"><RefinanciamientosReportePage /></ProtectedRoute>} />
              <Route path="*" element={<PlaceholderPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
