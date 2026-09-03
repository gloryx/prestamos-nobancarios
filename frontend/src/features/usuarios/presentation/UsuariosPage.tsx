import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import { AxiosUsuarioRepository } from '../infrastructure/axios-usuario.repository'
import { changeUsuarioStatus, createUsuario, listUsuarios, updateUsuario } from '../application/usuarios.use-cases'
import { usuarioErrorMessage } from '../domain/usuario.error'
import type { ActualizarUsuarioInput, CrearUsuarioInput, Usuario, UsuarioPage } from '../domain/usuario.types'
import { UsuarioForm } from './UsuarioForm'

const repository = new AxiosUsuarioRepository()
export function UsuariosPage() {
  const [page, setPage] = useState<UsuarioPage | null>(null); const [editing, setEditing] = useState<Usuario | null | undefined>(undefined); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { setPage(await listUsuarios(repository, { pagina: 1, limite: 100 })); setError('') } catch (e) { setError(usuarioErrorMessage(e)) } finally { setLoading(false) } }, [])
  useEffect(() => {
    let cancelled = false

    void listUsuarios(repository, { pagina: 1, limite: 100 })
      .then((result) => {
        if (cancelled) return
        setPage(result)
        setError('')
        setLoading(false)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(usuarioErrorMessage(cause))
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])
  const save = async (input: CrearUsuarioInput | ActualizarUsuarioInput) => { try { if (editing) await updateUsuario(repository, editing.id, input); else await createUsuario(repository, input as CrearUsuarioInput); setEditing(undefined); await load() } catch (e) { setError(usuarioErrorMessage(e)) } }
  const toggle = async (usuario: Usuario) => { if (!window.confirm(`${usuario.activo ? 'Inactivar' : 'Activar'} a ${usuario.nombreCompleto}?`)) return; try { await changeUsuarioStatus(repository, usuario.id, !usuario.activo); await load() } catch (e) { setError(usuarioErrorMessage(e)) } }
  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h1></div></div><div className="panel usuario-panel"><UsuarioForm usuario={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Usuarios</h1><p className="muted">Administrá los accesos y roles del sistema.</p></div><button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Nuevo usuario</button></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="panel state-box">Cargando usuarios...</div> : !page?.datos.length ? <div className="panel state-box">No hay usuarios para mostrar.</div> : <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{page.datos.map((usuario) => <tr key={usuario.id}><td>{usuario.identificacion}</td><td>{usuario.nombreCompleto}</td><td>{usuario.telefono || '—'}</td><td>{usuario.correo || '—'}</td><td>{usuario.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Vendedor'}</td><td><span className={`status-badge ${usuario.activo ? 'active' : 'inactive'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td><td><button className="table-action" onClick={() => setEditing(usuario)} aria-label={`Editar ${usuario.nombreCompleto}`}><Pencil size={15} /></button><button className="table-action" onClick={() => void toggle(usuario)} aria-label={`${usuario.activo ? 'Inactivar' : 'Activar'} ${usuario.nombreCompleto}`}><Power size={15} /></button></td></tr>)}</tbody></table></div>}</section>
}
