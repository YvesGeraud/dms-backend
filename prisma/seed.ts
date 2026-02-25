// ⚠️ IMPORTANTE: Cargar variables de entorno ANTES de cualquier import que las use
import "dotenv/config";
import { prisma } from "../src/config/database.config";

async function main() {
  console.log("🌱 Iniciando seed de tipos de documento...");

  // Limpiar datos existentes (en orden inverso por las relaciones)
  console.log("🧹 Limpiando datos existentes...");

  await prisma.dt_documento.deleteMany();
  await prisma.ct_tipo_documento.deleteMany();

  console.log("✅ Datos limpiados");

  console.log("🌱 Iniciando seed de tipos de documento...");

  // Crear categorías con upsert (crea o actualiza si existe)
  const categorias = await Promise.all([
    prisma.ct_tipo_documento.upsert({
      where: { clave: "IDENTIFICACION_OFICIAL" },
      update: {},
      create: {
        clave: "IDENTIFICACION_OFICIAL",
        descripcion: "Identificación oficial vigente (INE, pasaporte, cédula)",
        max_size_bytes: 5_242_880, // 5 MB
        extensiones_permitidas: JSON.stringify(["pdf", "jpg", "jpeg", "png"]),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: "COMPROBANTE_DOMICILIO" },
      update: {},
      create: {
        clave: "COMPROBANTE_DOMICILIO",
        descripcion: "Comprobante de domicilio no mayor a 3 meses",
        max_size_bytes: 5_242_880,
        extensiones_permitidas: JSON.stringify(["pdf", "jpg", "jpeg", "png"]),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: "ACTA_CONSTITUTIVA" },
      update: {},
      create: {
        clave: "ACTA_CONSTITUTIVA",
        descripcion: "Acta constitutiva de la empresa",
        max_size_bytes: 10_485_760, // 10 MB
        extensiones_permitidas: JSON.stringify(["pdf"]),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: "CONTRATO" },
      update: {},
      create: {
        clave: "CONTRATO",
        descripcion: "Contrato firmado entre las partes",
        max_size_bytes: 10_485_760,
        extensiones_permitidas: JSON.stringify(["pdf"]),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: "FACTURA" },
      update: {},
      create: {
        clave: "FACTURA",
        descripcion: "Factura electrónica (CFDI)",
        max_size_bytes: 2_097_152, // 2 MB
        extensiones_permitidas: JSON.stringify(["pdf", "xml"]),
        id_ct_usuario_in: 1,
      },
    }),
    prisma.ct_tipo_documento.upsert({
      where: { clave: "IMAGEN_GENERAL" },
      update: {},
      create: {
        clave: "IMAGEN_GENERAL",
        descripcion: "Imagen de uso general",
        max_size_bytes: 8_388_608, // 8 MB
        extensiones_permitidas: JSON.stringify(["jpg", "jpeg", "png", "webp", "gif"]),
        id_ct_usuario_in: 1,
      },
    }),
  ]);

  console.log("✅ Tipos de documento creados");
}

main().catch((e) => {
  console.error("❌ Error en seed:", e);
  process.exit(1);
});