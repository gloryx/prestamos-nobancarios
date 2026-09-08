import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import { AxiosUsuarioRepository } from '../infrastructure/axios-usuario.repository'
import { changeUsuarioStatus, createUsuario, listUsuarios, updateUsuario } from '../application/usuarios.use-cases'
import { usuarioErrorMessage } from '../domain/usuario.error'
import type { ActualizarUsuarioInput, CrearUsuarioInput, Usuario, UsuarioPage } from '../domain/usuario.types'
import { confirmAction } from '@/shared/utils/sweet-alert'
import { Pagination } from '@/shared/components/Pagination'
import { UsuarioForm } from './UsuarioForm'

const repository = new AxiosUsuarioRepository()
export function UsuariosPage() {
  const [page, setPage] = useState<UsuarioPage | null>(null); const [editing, setEditing] = useState<Usuario | null | undefined>(undefined); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [pagina, setPagina] = useState(1); const [limite, setLimite] = useState(10)
  const load = useCallback(async () => { setLoading(true); try { const result = await listUsuarios(repository, { pagina, limite }); setPage(result.pagina === pagina ? result : { ...result, pagina }); setError('') } catch (e) { setError(usuarioErrorMessage(e)) } finally { setLoading(false) } }, [limite, pagina])
  useEffect(() => { void load() }, [load])
  const save = async (input: CrearUsuarioInput | ActualizarUsuarioInput) => { try { if (editing) await updateUsuario(repository, editing.id, input); else await createUsuario(repository, input as CrearUsuarioInput); setEditing(undefined); await load() } catch (e) { setError(usuarioErrorMessage(e)) } }
  const toggle = async (usuario: Usuario) => {
    const disabling = usuario.activo
    try {
      const confirmed = await confirmAction({
        title: disabling ? 'Deshabilitar usuario' : 'Habilitar usuario',
        text: disabling ? `¿Está seguro de que desea deshabilitar a ${usuario.nombreCompleto}?` : `¿Está seguro de que desea habilitar a ${usuario.nombreCompleto}?`,
        confirmButtonText: disabling ? 'Sí, deshabilitar' : 'Sí, habilitar',
        loadingTitle: disabling ? 'Deshabilitando usuario...' : 'Habilitando usuario...',
        successTitle: disabling ? 'Usuario deshabilitado' : 'Usuario habilitado',
        errorTitle: disabling ? 'No se pudo deshabilitar el usuario' : 'No se pudo habilitar el usuario',
        getErrorMessage: usuarioErrorMessage,
        action: async () => { await changeUsuarioStatus(repository, usuario.id, !usuario.activo) },
      })
      if (confirmed) await load()
    } catch (e) { setError(usuarioErrorMessage(e)) }
  }
  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h1></div></div><div className="panel usuario-panel"><UsuarioForm usuario={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Usuarios</h1><p className="muted">Administrá los accesos y roles del sistema.</p></div><button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Nuevo usuario</button></div>{error && <p className="form-error" role="alert">{error}</p>}{loading && !page ? <div className="panel state-box">Cargando usuarios...</div> : page && !page.datos.length ? <div className="panel state-box">No hay usuarios para mostrar.</div> : page && <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{page.datos.map((usuario) => <tr key={usuario.id}><td>{usuario.identificacion}</td><td>{usuario.nombreCompleto}</td><td>{usuario.telefono || '—'}</td><td>{usuario.correo || '—'}</td><td>{usuario.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Vendedor'}</td><td><span className={`status-badge ${usuario.activo ? 'active' : 'inactive'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td><td><button className="table-action" onClick={() => setEditing(usuario)} aria-label={`Editar ${usuario.nombreCompleto}`}><Pencil size={15} /></button><button className="table-action" onClick={() => void toggle(usuario)} aria-label={`${usuario.activo ? 'Inactivar' : 'Activar'} ${usuario.nombreCompleto}`}><Power size={15} /></button></td></tr>)}</tbody></table></div>}{page && <Pagination pagina={pagina} totalPaginas={page.totalPaginas} total={page.total} limite={limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={setPagina} onLimitChange={(value) => { setLimite(value); setPagina(1) }} label="usuarios" disabled={loading} />}</section>
}
