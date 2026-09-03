import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { WalletCards } from 'lucide-react'
import { obtenerVistaPreviaCartera } from '../application/configuracion-financiera.use-cases'
import { ApiConfiguracionFinancieraRepository } from '../infrastructure/axios-configuracion-financiera.repository'
import { configuracionFinancieraErrorMessage } from '../domain/configuracion-financiera.error'
import type { CrearConfiguracionFinanciera, VistaPreviaCartera } from '../domain/configuracion-financiera.types'
import { CurrencyInput } from '../../../shared/components/forms/CurrencyInput'
import { formatCRC } from '../../../shared/utils/currency'

const nonNegativeMoney = z.number({ error: 'Ingresá un importe.' }).finite('Ingresá un importe válido.').min(0, 'El importe no puede ser negativo.')
const schema = z.object({ fechaApertura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida.'), disponibleInicial: nonNegativeMoney, capitalSemillaHistorico: nonNegativeMoney.nullable(), observaciones: z.string().max(1000, 'Máximo 1000 caracteres.') })
type Values = z.infer<typeof schema>
const today = () => new Date().toISOString().slice(0, 10)

export function ConfiguracionFinancieraForm({ onSubmit }: { onSubmit: (input: CrearConfiguracionFinanciera) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fechaApertura: today(), disponibleInicial: undefined, capitalSemillaHistorico: null, observaciones: '' } })
  const date = useWatch({ control, name: 'fechaApertura' })
  const [preview, setPreview] = useState<VistaPreviaCartera | null>(null)
  const [previewDate, setPreviewDate] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewErrorDate, setPreviewErrorDate] = useState('')
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return
    let cancelled = false
    void obtenerVistaPreviaCartera(new ApiConfiguracionFinancieraRepository(), date).then((value) => { if (!cancelled) { setPreview(value); setPreviewDate(date) } }).catch((cause) => { if (!cancelled) { setPreviewError(`No pudimos consultar la cartera para esa fecha. ${configuracionFinancieraErrorMessage(cause)}`); setPreviewErrorDate(date) } })
    return () => { cancelled = true }
  }, [date])
  const submit = (values: Values) => onSubmit({ ...values, observaciones: values.observaciones.trim() || null })
  return <form className="financial-form" onSubmit={handleSubmit(submit)} noValidate>
    <div className="financial-form-grid">
      <div className="financial-card financial-card-wide"><div className="panel-title"><div><h3>FECHA DE APERTURA</h3><p className="muted">Elegí la fecha desde la que comienza el control.</p></div></div><label>Fecha de apertura<input type="date" {...register('fechaApertura')} aria-invalid={!!errors.fechaApertura} />{errors.fechaApertura && <small className="field-error">{errors.fechaApertura.message}</small>}</label></div>
       <div className="financial-card financial-card-wide"><div className="panel-title"><div><h3>CARTERA INICIAL</h3><p className="muted">Calculada por el sistema según la fecha elegida.</p></div><WalletCards size={18} /></div>{previewError && previewErrorDate === date ? <p className="form-error" role="alert">{previewError}</p> : preview && previewDate === date ? <div className="preview-grid"><PreviewItem label="Activa" value={formatCRC(preview.carteraActiva)} /><PreviewItem label="Incobrable" value={formatCRC(preview.carteraIncobrable)} /><PreviewItem label="Total" value={formatCRC(preview.carteraTotal)} /></div> : <p className="muted" aria-live="polite">Consultando cartera...</p>}</div>
       <div className="financial-card"><h3>DISPONIBLE INICIAL</h3><label htmlFor="disponibleInicial">Importe disponible<Controller name="disponibleInicial" control={control} render={({ field }) => <CurrencyInput {...field} id="disponibleInicial" value={field.value} aria-invalid={!!errors.disponibleInicial} />} />{errors.disponibleInicial && <small className="field-error">{errors.disponibleInicial.message}</small>}</label></div>
       <div className="financial-card"><h3>CAPITAL SEMILLA HISTÓRICO</h3><p className="muted">Información histórica del capital con el que inició el negocio.</p><label htmlFor="capitalSemillaHistorico">Importe histórico (opcional)<Controller name="capitalSemillaHistorico" control={control} render={({ field }) => <CurrencyInput {...field} id="capitalSemillaHistorico" value={field.value} aria-invalid={!!errors.capitalSemillaHistorico} />} />{errors.capitalSemillaHistorico && <small className="field-error">{errors.capitalSemillaHistorico.message}</small>}</label></div>
      <div className="financial-card financial-card-wide"><h3>OBSERVACIONES</h3><label>Comentarios (opcional)<textarea rows={4} maxLength={1000} {...register('observaciones')} aria-invalid={!!errors.observaciones} />{errors.observaciones && <small className="field-error">{errors.observaciones.message}</small>}</label></div>
    </div>
    <div className="financial-form-actions"><button className="primary-button" type="submit" disabled={isSubmitting || !preview}>{isSubmitting ? 'Guardando...' : 'Realizar apertura'}</button></div>
  </form>
}
function PreviewItem({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
