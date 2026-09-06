const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { ClienteIdentificacionStorageService, extensionForFile, normalizeClientIdentification, MAX_IDENTIFICATION_FILE_SIZE } = require('../dist/modules/clientes/infrastructure/storage/cliente-identificacion-storage.service')

const directory = path.resolve(process.cwd(), 'uploads/clientes/identificaciones')
const images = {
  'image/png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  'image/jpeg': Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8Af//Z', 'base64'),
  'image/webp': Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=', 'base64'),
}
const jpegWithExif = Buffer.from('/9j/4QDORXhpZgAASUkqAAgAAAAHABIBAwABAAAAAQAAABoBBQABAAAAYgAAABsBBQABAAAAagAAACgBAwABAAAAAgAAADsBAgAFAAAAcgAAABMCAwABAAAAAQAAAGmHBAABAAAAeAAAAAAAAAA4YwAA6AMAADhjAADoAwAAdGVzdAAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAQAAQAAAAEAAAADoAQAAQAAAAEAAAAAAAAA/+IB8ElDQ19QUk9GSUxFAAEBAAAB4GxjbXMEIAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5keem/Vlo+AbaDI4VVRvdPqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAkY3BydAAAASAAAAAid3RwdAAAAUQAAAAUY2hhZAAAAVgAAAAsclhZWgAAAYQAAAAUZ1hZWgAAAZgAAAAUYlhZWgAAAawAAAAUclRSQwAAAcAAAAAgZ1RSQwAAAcAAAAAgYlRSQwAAAcAAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAGAAAAHABDAEMAMAAAWFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDD8AAAXd///zJgAAB5AAAP2S///7of///aIAAAPcAADAcVhZWiAAAAAAAABvoAAAOPIAAAOPWFlaIAAAAAAAAGKWAAC3iQAAGNpYWogAAAAAAAAJKAAAA+FAAC2xHBhcmEAAAAAAAMAAAACZmkAAPKnAAANWQAAE9AAAApb/9sAQwAGBAUGBQQGBgUGBwcGCAoQCgoJCQoUDg8MEBcUGBgXFBYWGh0lHxobIxwWFiAsICMmJykqKRkfLTAtKDAlKCko/9sAQwEHBwcKCAoTCgoTKBoWGigoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgo/8AAEQgAAQABAwEiAAIRAQMRAf/EABUAAQEAAAAAAAAAAAAAAAAAAAAF/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC6AHwK/9k=', 'base64')
const file = (name, type, buffer = images[type]) => ({ originalname: name, mimetype: type, buffer })

test('normalizes identification and rejects path traversal', () => {
  assert.equal(normalizeClientIdentification(' 5-0456-0789 '), '504560789')
  assert.throws(() => normalizeClientIdentification('../etc'), /caracteres no permitidos/)
  assert.throws(() => normalizeClientIdentification('5/0456'), /caracteres no permitidos/)
})

test('accepts allowed extensions without decoding in the synchronous filter', () => {
  assert.equal(extensionForFile({ originalname: 'id.jpg', mimetype: 'image/jpeg' }), '.jpg')
  assert.equal(extensionForFile(file('id.JPG', 'image/jpeg')), '.jpg')
  assert.equal(extensionForFile(file('id.jpeg', 'image/jpeg')), '.jpeg')
  assert.equal(extensionForFile(file('id.png', 'image/png')), '.png')
  assert.equal(extensionForFile(file('id.webp', 'image/webp')), '.webp')
  assert.throws(() => extensionForFile(file('id.jpg', 'image/png')))
  assert.throws(() => extensionForFile(file('id.gif', 'image/gif')))
})

test('uses exactly a 5 MiB upload limit', () => {
  assert.equal(MAX_IDENTIFICATION_FILE_SIZE, 5 * 1024 * 1024)
})

test('replaces the same identification, cleans extension changes, and renames safely', async (t) => {
  await fs.rm(directory, { recursive: true, force: true })
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const storage = new ClienteIdentificacionStorageService()
  let operation = await storage.prepareUpload('5-0456-0789', file('original.jpg', 'image/jpeg'))
  await operation.commit()
  assert.deepEqual(await fs.readdir(directory), ['504560789.jpg'])
  operation = await storage.prepareUpload('5-0456-0789', file('replacement.png', 'image/png'))
  await operation.commit()
  assert.deepEqual(await fs.readdir(directory), ['504560789.png'])
  operation = await storage.prepareRename('/uploads/clientes/identificaciones/504560789.png', '5-0456-0789', '5-0456-0790')
  await operation.commit()
  assert.deepEqual(await fs.readdir(directory), ['504560790.png'])
})

test('stages the previous identification image with replacement and restores it on rollback', async (t) => {
  await fs.rm(directory, { recursive: true, force: true })
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const storage = new ClienteIdentificacionStorageService()
  let operation = await storage.prepareUpload('5-0456-0789', file('original.jpg', 'image/jpeg'))
  await operation.commit()

  operation = await storage.prepareUpload('5-0456-0790', file('replacement.webp', 'image/webp'), {
    url: '/uploads/clientes/identificaciones/504560789.jpg',
    identification: '5-0456-0789',
  })
  const staged = await fs.readdir(directory)
  assert.equal(staged.filter((name) => name === '504560790.webp').length, 1)
  assert.equal(staged.filter((name) => /^504560789\.jpg\.[0-9a-f-]+\.bak$/.test(name)).length, 1)
  await operation.rollback()
  assert.deepEqual(await fs.readdir(directory), ['504560789.jpg'])

  operation = await storage.prepareUpload('5-0456-0790', file('replacement.webp', 'image/webp'), {
    url: '/uploads/clientes/identificaciones/504560789.jpg',
    identification: '5-0456-0789',
  })
  await operation.commit()
  assert.deepEqual(await fs.readdir(directory), ['504560790.webp'])
})

test('returns image bytes safely and reports missing images as not found', async (t) => {
  await fs.rm(directory, { recursive: true, force: true })
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const storage = new ClienteIdentificacionStorageService()
  await assert.rejects(storage.readImage(null), { status: 404 })
  await assert.rejects(storage.readImage('/uploads/clientes/identificaciones/../secret.jpg'), { status: 404 })
  const operation = await storage.prepareUpload('5-0456-0789', file('client.png', 'image/png'))
  await operation.commit()
  const image = await storage.readImage(operation.url)
  assert.equal(image.mimetype, 'image/png')
  assert.deepEqual(image.buffer, images['image/png'])
  await fs.rm(path.join(directory, '504560789.png'))
  await assert.rejects(storage.readImage(operation.url), { status: 404 })
})

test('decodes valid PNG, JPEG, WEBP, and transparent PNG before writing', async (t) => {
  await fs.rm(directory, { recursive: true, force: true })
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const storage = new ClienteIdentificacionStorageService()
  for (const [index, current] of [file('normal.png', 'image/png'), file('photo.jpg', 'image/jpeg'), file('photo.webp', 'image/webp'), file('transparent.png', 'image/png')].entries()) {
    const operation = await storage.prepareUpload(`7-0000-000${index}`, current)
    await operation.rollback()
  }
})

test('rejects invalid binary content during prepareUpload before writing', async (t) => {
  await fs.rm(directory, { recursive: true, force: true })
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const storage = new ClienteIdentificacionStorageService()
  await assert.rejects(storage.prepareUpload('5-0456-0789', { originalname: 'id.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('not-jpeg') }), /no contiene una imagen válida/)
  await assert.rejects(fs.readdir(directory))
})

test('rejects non-images, incompatible MIME types, and unsupported image formats', async () => {
  const storage = new ClienteIdentificacionStorageService()
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.pdf', 'application/pdf', Buffer.from('%PDF-1.7'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.txt', 'text/plain', Buffer.from('text'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.gif', 'image/gif', Buffer.from('GIF89a'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.bmp', 'image/bmp', Buffer.from('BM'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.svg', 'image/svg+xml', Buffer.from('<svg/>'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.avif', 'image/avif', Buffer.from('ftypavif'))))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.png', 'image/png', Buffer.from('not an image'))))
  assert.throws(() => extensionForFile({ originalname: 'id.jpg', mimetype: 'image/png', buffer: images['image/png'] }))
  await assert.rejects(storage.prepareUpload('5-0456-0789', file('id.webp', 'image/webp', images['image/webp'].subarray(0, -20))))
})
