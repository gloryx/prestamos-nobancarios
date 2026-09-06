import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const ALLOWED_IDENTIFICATION_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const MAX_IDENTIFICATION_FILE_SIZE = 5 * 1024 * 1024;
type AllowedExtension = (typeof ALLOWED_IDENTIFICATION_EXTENSIONS)[number];
type ImageFormat = 'jpeg' | 'png' | 'webp';
const MIME_BY_EXTENSION: Record<AllowedExtension, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const FORMAT_BY_MIME: Record<string, ImageFormat | undefined> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

export function normalizeClientIdentification(value: string): string {
  const input = value.trim();
  if (!input || input.includes('..') || /[\\/:*?"<>|]/.test(input) || !/^[\p{L}\p{N}\-\s]+$/u.test(input)) throw new BadRequestException('La identificación contiene caracteres no permitidos.');
  const normalized = input.replace(/[\s-]/g, '').toUpperCase();
  if (!normalized) throw new BadRequestException('La identificación no es válida.');
  return normalized;
}

export function extensionForFile(file: { originalname: string; mimetype: string; buffer?: Buffer }): AllowedExtension {
  const extension = extname(file.originalname).toLowerCase() as AllowedExtension;
  const declaredFormat = FORMAT_BY_MIME[file.mimetype];
  if (!declaredFormat) throw new BadRequestException('La imagen debe ser un archivo JPG, PNG o WEBP válido.');
  if (!ALLOWED_IDENTIFICATION_EXTENSIONS.includes(extension) || MIME_BY_EXTENSION[extension] !== file.mimetype) throw new BadRequestException('La imagen debe ser un archivo JPG, PNG o WEBP válido.');
  return extension;
}

export async function validateImageContent(file: { mimetype: string; buffer: Buffer }): Promise<void> {
  if (!FORMAT_BY_MIME[file.mimetype]) throw new BadRequestException('La imagen debe ser un archivo JPG, PNG o WEBP válido.');
  try {
    const metadata = await sharp(file.buffer).metadata();
    if (!(['jpeg', 'png', 'webp'] as const).includes(metadata.format as ImageFormat)) throw new Error('Unsupported image format');
  } catch {
    throw new BadRequestException('El archivo seleccionado no contiene una imagen válida.');
  }
}

export interface FileOperation { url: string; commit(): Promise<void>; rollback(): Promise<void>; }
export interface IdentificationImage { buffer: Buffer; mimetype: string; }

@Injectable()
export class ClienteIdentificacionStorageService {
  private readonly directory = resolve(process.cwd(), 'uploads/clientes/identificaciones');
  private readonly urlPrefix = '/uploads/clientes/identificaciones/';

  private async filesFor(base: string): Promise<string[]> {
    const entries = await fs.readdir(this.directory, { withFileTypes: true }).catch(() => []);
    return entries.filter((entry) => entry.isFile() && basename(entry.name, extname(entry.name)) === base && ALLOWED_IDENTIFICATION_EXTENSIONS.includes(extname(entry.name).toLowerCase() as AllowedExtension)).map((entry) => join(this.directory, entry.name));
  }

  async prepareUpload(identification: string, file: { originalname: string; mimetype: string; buffer: Buffer }, previous?: { url: string | null; identification: string }): Promise<FileOperation> {
    const base = normalizeClientIdentification(identification); const extension = extensionForFile(file); await validateImageContent(file);
    await fs.mkdir(this.directory, { recursive: true });
    const target = join(this.directory, `${base}${extension}`); const temporary = join(this.directory, `.${base}.${randomUUID()}.tmp`); const backups: Array<[string, string]> = [];
    await fs.writeFile(temporary, file.buffer, { flag: 'wx' });
    const previousBase = previous?.url?.startsWith('/uploads/clientes/identificaciones/') ? normalizeClientIdentification(previous.identification) : undefined;
    const pathsToStage = new Set([...await this.filesFor(base), ...(previousBase ? await this.filesFor(previousBase) : [])]);
    try { for (const oldPath of pathsToStage) { const backup = `${oldPath}.${randomUUID()}.bak`; await fs.rename(oldPath, backup); backups.push([oldPath, backup]); } await fs.rename(temporary, target); }
    catch (error) { await fs.rm(temporary, { force: true }); for (const [oldPath, backup] of backups) await fs.rename(backup, oldPath).catch(() => undefined); throw error; }
    return this.operation(`${this.urlPrefix}${base}${extension}`, target, backups);
  }

  async prepareRename(oldUrl: string | null, oldIdentification: string, newIdentification: string): Promise<FileOperation | undefined> {
    const oldBase = normalizeClientIdentification(oldIdentification); const newBase = normalizeClientIdentification(newIdentification);
    if (oldBase === newBase || !oldUrl?.startsWith('/uploads/clientes/identificaciones/')) return undefined;
    const source = (await this.filesFor(oldBase))[0]; if (!source) return undefined;
    await fs.mkdir(this.directory, { recursive: true }); const extension = extname(source).toLowerCase() as AllowedExtension; const target = join(this.directory, `${newBase}${extension}`); const backups: Array<[string, string]> = [];
    for (const oldPath of await this.filesFor(newBase)) { const backup = `${oldPath}.${randomUUID()}.bak`; await fs.rename(oldPath, backup); backups.push([oldPath, backup]); }
    const sourceBackup = `${source}.${randomUUID()}.bak`; await fs.rename(source, sourceBackup); backups.push([source, sourceBackup]);
    try { await fs.rename(sourceBackup, target); } catch (error) { for (const [oldPath, backup] of backups.reverse()) await fs.rename(backup, oldPath).catch(() => undefined); throw error; }
    return this.operation(`${this.urlPrefix}${newBase}${extension}`, target, backups);
  }

  async readImage(url: string | null): Promise<IdentificationImage> {
    if (!url?.startsWith(this.urlPrefix)) throw new NotFoundException('Imagen de identificación no disponible.');
    const filename = url.slice(this.urlPrefix.length);
    const extension = extname(filename).toLowerCase() as AllowedExtension;
    const base = basename(filename, extname(filename));
    let normalizedBase: string;
    try { normalizedBase = normalizeClientIdentification(base); } catch { throw new NotFoundException('Imagen de identificación no disponible.'); }
    if (filename !== basename(filename) || !ALLOWED_IDENTIFICATION_EXTENSIONS.includes(extension) || normalizedBase !== base) throw new NotFoundException('Imagen de identificación no disponible.');
    try { return { buffer: await fs.readFile(join(this.directory, filename)), mimetype: MIME_BY_EXTENSION[extension] }; } catch { throw new NotFoundException('Imagen de identificación no disponible.'); }
  }

  private operation(url: string, target: string, backups: Array<[string, string]>): FileOperation { return { url, commit: async () => { for (const [, backup] of backups) await fs.rm(backup, { force: true }); }, rollback: async () => { await fs.rm(target, { force: true }); for (const [oldPath, backup] of backups.reverse()) await fs.rename(backup, oldPath).catch(() => undefined); } }; }
}
