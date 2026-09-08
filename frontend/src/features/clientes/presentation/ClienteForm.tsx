import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  Cliente,
  ClienteInput,
  Genero,
  Nacionalidad,
} from "../domain/cliente.types";

const schema = z.object({
  identificacion: z
    .string()
    .trim()
    .min(1, "La identificación es obligatoria.")
    .max(30, "Máximo 30 caracteres."),
  primerNombre: z
    .string()
    .trim()
    .min(1, "El primer nombre es obligatorio.")
    .max(100, "Máximo 100 caracteres."),
  segundoNombre: z.string().max(100, "Máximo 100 caracteres."),
  primerApellido: z
    .string()
    .trim()
    .min(1, "El primer apellido es obligatorio.")
    .max(100, "Máximo 100 caracteres."),
  segundoApellido: z.string().max(100, "Máximo 100 caracteres."),
  genero: z.enum(["", "FEMENINO", "MASCULINO"]),
  fechaNacimiento: z
    .string()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Usá el formato AAAA-MM-DD.",
    ),
  direccion: z.string().max(500, "Máximo 500 caracteres."),
  correo: z.union([
    z.literal(""),
    z
      .string()
      .email("Ingresá un correo válido.")
      .max(150, "Máximo 150 caracteres."),
  ]),
  telefono1: z
    .string()
    .trim()
    .min(1, "El teléfono principal es obligatorio.")
    .max(30, "Máximo 30 caracteres."),
  telefono2: z.string().max(30, "Máximo 30 caracteres."),
  nacionalidad: z.enum([
    "",
    "COSTARRICENSE",
    "NICARAGUENSE",
    "PANAMEÑO",
    "ARABE",
  ]),
  observaciones: z.string(),
  identificacionFile: z.custom<FileList | undefined>().optional().superRefine((files, context) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) context.addIssue({ code: "custom", message: "La imagen de identificación no puede superar los 5 MB." });
    if (!("image/jpeg" === file.type || "image/png" === file.type || "image/webp" === file.type)) context.addIssue({ code: "custom", message: "La imagen debe ser un archivo JPG, PNG o WEBP válido." });
  }),
});
type Values = z.infer<typeof schema>;
const defaults = (cliente?: Cliente): Values => ({
  identificacion: cliente?.identificacion ?? "",
  primerNombre: cliente?.primerNombre ?? "",
  segundoNombre: cliente?.segundoNombre ?? "",
  primerApellido: cliente?.primerApellido ?? "",
  segundoApellido: cliente?.segundoApellido ?? "",
  genero: cliente?.genero ?? "",
  fechaNacimiento: cliente?.fechaNacimiento ?? "",
  direccion: cliente?.direccion ?? "",
  correo: cliente?.correo ?? "",
  telefono1: cliente?.telefono1 ?? "",
  telefono2: cliente?.telefono2 ?? "",
  nacionalidad: cliente?.nacionalidad ?? "",
  observaciones: cliente?.observaciones ?? "",
  identificacionFile: undefined,
});
const optional = (value: string) => value.trim() || null;
const optionalEmail = (value: string) => value.trim() || undefined;

export function ClienteForm({
  cliente,
  existingImageUrl,
  onCancel,
  onSubmit,
}: {
  cliente?: Cliente;
  existingImageUrl?: string | null;
  onCancel: () => void;
  onSubmit: (input: ClienteInput) => Promise<void>;
}) {
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(cliente),
  });
  useEffect(() => {
    reset(defaults(cliente));
  }, [cliente, reset]);
  useEffect(() => () => { if (localImageUrl) URL.revokeObjectURL(localImageUrl); }, [localImageUrl]);
  const fileRegistration = register("identificacionFile");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const submit = (values: Values) =>
    onSubmit({
      identificacion: values.identificacion.trim(),
      primerNombre: values.primerNombre.trim(),
      segundoNombre: optional(values.segundoNombre),
      primerApellido: values.primerApellido.trim(),
      segundoApellido: optional(values.segundoApellido),
      genero: (values.genero || null) as Genero | null,
      fechaNacimiento: optional(values.fechaNacimiento),
      direccion: optional(values.direccion),
      correo: optionalEmail(values.correo)?.toLowerCase(),
      telefono1: values.telefono1.trim(),
      telefono2: optional(values.telefono2),
      nacionalidad: (values.nacionalidad || null) as Nacionalidad | null,
      observaciones: optional(values.observaciones),
      identificacionFile: values.identificacionFile?.[0] ?? null,
    });
  const field = (name: keyof Values) =>
    errors[name] && (
      <small className="field-error">{errors[name]?.message as string}</small>
    );
  return (
    <form className="cliente-form" onSubmit={handleSubmit(submit)} noValidate>
      <div className="cliente-form-layout">
        <div className="cliente-form-row">
          <fieldset>
            <legend>Datos personales</legend>
            <div className="cliente-form-grid">
              <label>
                Identificación
                <input {...register("identificacion")} />
                {field("identificacion")}
              </label>
              <label>
                Primer nombre
                <input {...register("primerNombre")} />
                {field("primerNombre")}
              </label>
              <label>
                Segundo nombre
                <input {...register("segundoNombre")} />
                {field("segundoNombre")}
              </label>
              <label>
                Primer apellido
                <input {...register("primerApellido")} />
                {field("primerApellido")}
              </label>
              <label>
                Segundo apellido
                <input {...register("segundoApellido")} />
                {field("segundoApellido")}
              </label>
              <label>
                Género
                <select {...register("genero")}>
                  <option value="">Sin especificar</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="MASCULINO">Masculino</option>
                </select>
              </label>
              <label>
                Fecha de nacimiento
                <input type="date" {...register("fechaNacimiento")} />
                {field("fechaNacimiento")}
              </label>
              <label>
                Nacionalidad
                <select {...register("nacionalidad")}>
                  <option value="">Sin especificar</option>
                  <option value="COSTARRICENSE">Costarricense</option>
                  <option value="NICARAGUENSE">Nicaragüense</option>
                  <option value="PANAMEÑO">Panameño</option>
                  <option value="ARABE">Árabe</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="cliente-identificacion-fieldset">
            <legend>Imagen de identificación</legend>
            <div className="cliente-identificacion-upload-row">
              <div className="cliente-identificacion-preview-area">
                {localImageUrl || existingImageUrl ? <img className="cliente-identificacion-preview" src={localImageUrl || existingImageUrl!} alt="Vista previa de la identificación" /> : <p className="form-note">Imagen no disponible.</p>}
              </div>
              <div className="cliente-identificacion-upload-control">
                <input
                  id="cliente-identificacion-file"
                  type="file"
                  accept=".jpg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="cliente-identificacion-file-input"
                  {...fileRegistration}
                  onChange={(event) => { fileRegistration.onChange(event); if (localImageUrl) URL.revokeObjectURL(localImageUrl); const file = event.target.files?.[0] ?? null; setSelectedFile(file); setLocalImageUrl(file ? URL.createObjectURL(file) : null); }}
                />
                <label className="cliente-identificacion-file-button secondary-button" htmlFor="cliente-identificacion-file">Seleccionar archivo</label>
                <span className="cliente-identificacion-file-name">{selectedFile?.name ?? (existingImageUrl ? "Imagen actual" : "Ningún archivo seleccionado")}</span>
                {field("identificacionFile")}
              </div>
            </div>
          </fieldset>
        </div>
        <div className="cliente-form-row cliente-form-row-secondary">
          <fieldset>
            <legend>Contacto</legend>
            <div className="cliente-form-grid">
              <label>
                Teléfono principal
                <input {...register("telefono1")} />
                {field("telefono1")}
              </label>
              <label>
                Teléfono secundario
                <input {...register("telefono2")} />
                {field("telefono2")}
              </label>
              <label>
                Correo electrónico
                <input type="email" {...register("correo")} />
                {field("correo")}
              </label>
              <label className="cliente-wide">
                Dirección
                <textarea rows={2} {...register("direccion")} />
                {field("direccion")}
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Información adicional</legend>
            <label>
              Observaciones
              <textarea rows={3} {...register("observaciones")} />
              {field("observaciones")}
            </label>
          </fieldset>
        </div>
      </div>

      <div className="cliente-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Guardando..."
            : cliente
              ? "Guardar cambios"
              : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
