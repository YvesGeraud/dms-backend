import 'dotenv/config';
import { prisma } from '../src/config/database.config';
import { RolUsuario } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Limpiar datos existentes (en orden inverso por las relaciones)
  console.log('🧹 Limpiando datos existentes...');
  await prisma.ct_tipo_documento.deleteMany();
  await prisma.dt_documento.deleteMany();

  console.log('✅ Datos limpiados');

  // Crear categorías con upsert (crea o actualiza si existe)
  const tiposDocumento = await Promise.all([
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'IDENTIFICACION_OFICIAL' },
      update: {},
      create: {
        clave: 'IDENTIFICACION_OFICIAL',
        descripcion: 'Identificación oficial vigente (INE, pasaporte, cédula)',
        max_size_bytes: 5_242_880, // 5 MB
        extensiones_permitidas: JSON.stringify(['pdf', 'jpg', 'jpeg', 'png']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'COMPROBANTE_DOMICILIO' },
      update: {},
      create: {
        clave: 'COMPROBANTE_DOMICILIO',
        descripcion: 'Comprobante de domicilio no mayor a 3 meses',
        max_size_bytes: 5_242_880,
        extensiones_permitidas: JSON.stringify(['pdf', 'jpg', 'jpeg', 'png']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'ACTA_CONSTITUTIVA' },
      update: {},
      create: {
        clave: 'ACTA_CONSTITUTIVA',
        descripcion: 'Acta constitutiva de la empresa',
        max_size_bytes: 10_485_760, // 10 MB
        extensiones_permitidas: JSON.stringify(['pdf']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'CONTRATO' },
      update: {},
      create: {
        clave: 'CONTRATO',
        descripcion: 'Contrato firmado entre las partes',
        max_size_bytes: 10_485_760,
        extensiones_permitidas: JSON.stringify(['pdf']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'FACTURA' },
      update: {},
      create: {
        clave: 'FACTURA',
        descripcion: 'Factura electrónica (CFDI)',
        max_size_bytes: 2_097_152, // 2 MB
        extensiones_permitidas: JSON.stringify(['pdf', 'xml']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'IMAGEN_GENERAL' },
      update: {},
      create: {
        clave: 'IMAGEN_GENERAL',
        descripcion: 'Imagen de uso general',
        max_size_bytes: 8_388_608, // 8 MB
        extensiones_permitidas: JSON.stringify(['jpg', 'jpeg', 'png', 'webp', 'gif']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'imagenes' },
      update: {},
      create: {
        clave: 'imagenes',
        descripcion: 'Ruta general para imágenes del sistema',
        max_size_bytes: 2_097_152, // 2 MB (según tu ruta)
        extensiones_permitidas: JSON.stringify(['jpg', 'jpeg', 'png', 'webp', 'gif']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'documentos' },
      update: {},
      create: {
        clave: 'documentos',
        descripcion: 'Ruta general para documentos PDF/TXT',
        max_size_bytes: 10_485_760, // 10 MB (según ruta)
        extensiones_permitidas: JSON.stringify(['pdf', 'txt', 'csv']),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: 'excel' },
      update: {},
      create: {
        clave: 'excel',
        descripcion: 'Ruta general para documentos Excel',
        max_size_bytes: 5_242_880, // 5 MB
        extensiones_permitidas: JSON.stringify(['xlsx']),
        id_ct_usuario_in: 1,
      },
    }),
  ]);

  console.log('✅ Tipos de documento creados');

  console.log('🎉 Seed completado exitosamente!');
  console.log('\n📋 Datos de acceso:');
  console.log('   👤 Usuario mesero: mesero1');
  console.log('   👤 Usuario cocinero: cocinero1');
  console.log('   🔑 Contraseña para ambos: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
