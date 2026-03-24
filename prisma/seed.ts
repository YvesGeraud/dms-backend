import 'dotenv/config';
import { prisma } from '../src/config/database.config';
import { RolUsuario } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Limpiar datos existentes (en orden inverso por las relaciones)
  console.log('🧹 Limpiando datos existentes...');
  await prisma.dt_documento.deleteMany();
  await prisma.ct_tipo_documento.deleteMany();

  console.log('✅ Datos limpiados');

  const documentosData = [
    {
      clave: 'acta_nacimiento',
      descripcion: 'Acta de nacimiento',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'curp',
      descripcion: 'Curp actualizado',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'ine',
      descripcion: 'Ine escaneada',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'comprobante_domicilio',
      descripcion: 'Comprobante de domicilio no mayor a tres meses',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'comprobante_estudios',
      descripcion: 'Comprobante de estudios',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'ultimo_comprobante_estudios',
      descripcion: 'Ultimo comprobante de estudios',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'titulo_profesional',
      descripcion: 'Titulo profesional',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'cedula_profesional',
      descripcion: 'Cédula profesional',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'constancia_fiscal',
      descripcion: 'Constancia de situación fiscal',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'comun',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'carta_compromiso',
      descripcion: 'Carta compromiso del facilitador y diagnosticado',
      max_size_bytes: 786432,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'aneec',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'priv_diagnosticado',
      descripcion: 'privacidad de diagnosticado',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'aneec',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'diagnostico',
      descripcion: 'Diagnostico del diagnosticado',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'aneec',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'aviso_privacidad',
      descripcion: 'Aviso de privacidad del facilitador y diagnosticado',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'aneec',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'informe',
      descripcion: 'Informes de diagnosticados',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'aneec',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'carga_participantes',
      descripcion: 'Datos de constancia',
      max_size_bytes: 786432,
      extensiones_permitidas: JSON.stringify(['xls', 'xlsm', 'xlsb']),
      modulo: 'constancias',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'horario',
      descripcion: 'Horarios por periodo',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'proni',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'foto',
      descripcion: 'Evidencia fotografica',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['png', 'jpeg', 'gif', 'svg']),
      modulo: 'proni',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'planeacion',
      descripcion: 'Planeaciones de clase',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'proni',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'oficio_presentacion',
      descripcion: 'Oficio de presentación',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'proni',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'constancia_asistencia',
      descripcion: 'Constancia de asistencia',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'proni',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'Formato_factura_',
      descripcion: 'Formato de factura para altas y bajas',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'infraestructura',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'Formato_salidas',
      descripcion: 'Formato de salidas',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'consumibles',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'archivo_actualizacion',
      descripcion: 'Registro de archivos actualizafos de escalafon',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'escalafon',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'archivo_nuevo',
      descripcion: 'Archivo de correspondencia nueva',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'correspondencia',
      id_ct_usuario_in: 1,
    },
    {
      clave: 'respuesta',
      descripcion: 'Respuesta de correspondecia',
      max_size_bytes: 524288,
      extensiones_permitidas: JSON.stringify(['pdf']),
      modulo: 'correspondencia',
      id_ct_usuario_in: 1,
    },
  ];

  for (const doc of documentosData) {
    await prisma.ct_tipo_documento.upsert({
      where: { clave: doc.clave },
      update: doc,
      create: doc,
    });
  }

  console.log('✅ Tipos de documento creados');

  console.log('🎉 Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
