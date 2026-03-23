import type { Meta } from '@/utils/respuestas.utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface OpcionesPaginacion {
  pagina: number;
  limite: number;
  ordenarPor: string;
  orden: 'asc' | 'desc';
}

/**
 * Tipo genérico para cualquier modelo de Prisma que soporte paginación.
 * Evita usar `any` y mantiene seguridad de tipos sin depender de un modelo específico.
 */
type ModeloPaginable<T> = {
  findMany(args: {
    where?: object;
    include?: object;
    orderBy?: object | object[];
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  count(args: { where?: object }): Promise<number>;
};

// ── Funciones ─────────────────────────────────────────────────────────────────

/**
 * Parsea y sanitiza los query params de paginación.
 *
 * @param camposOrdenables - Whitelist de columnas permitidas para ordenar.
 *   IMPORTANTE: siempre pasar esta lista para evitar exponer columnas internas.
 *   Ejemplo: ['nombre', 'precio', 'fecha_registro']
 */
export function parsearPaginacion(
  query: Record<string, unknown>,
  camposOrdenables: readonly string[] = ['id'],
): OpcionesPaginacion {
  // Number() maneja correctamente strings, números y undefined.
  // El `|| n` sirve de fallback cuando el resultado es NaN o 0.
  const pagina = Math.max(1, Number(query['pagina']) || 1);
  const limite = Math.min(100, Math.max(1, Number(query['limite']) || 20));

  // Solo se acepta el campo si está en la whitelist; si no, se usa el primero de la lista
  const ordenarPorRaw = String(query['ordenar_por'] ?? '');
  const ordenarPor = camposOrdenables.includes(ordenarPorRaw)
    ? ordenarPorRaw
    : (camposOrdenables[0] ?? 'id');

  const orden: 'asc' | 'desc' = query['orden'] === 'desc' ? 'desc' : 'asc';

  return { pagina, limite, ordenarPor, orden };
}

/**
 * Ejecuta findMany + count en paralelo y devuelve datos + meta lista para
 * pasarse directamente a `responder.paginado(res, datos, meta)`.
 *
 * Uso:
 *   const { datos, ...meta } = await paginar(prisma.ct_platillo, where, opciones);
 *   return responder.paginado(res, datos, meta);
 */
export async function paginar<T>(
  modelo: ModeloPaginable<T>,
  where: object,
  opciones: OpcionesPaginacion,
  include?: object,
  orderBy?: object,
): Promise<{ datos: T[] } & Meta> {
  const skip = (opciones.pagina - 1) * opciones.limite;

  const [datos, totalRegistros] = await Promise.all([
    modelo.findMany({
      where,
      include,
      orderBy: orderBy ?? { [opciones.ordenarPor]: opciones.orden },
      skip,
      take: opciones.limite,
    }),
    modelo.count({ where }),
  ]);

  return {
    datos,
    pagina: opciones.pagina,
    totalPaginas: Math.ceil(totalRegistros / opciones.limite) || 1,
    totalRegistros,
    porPagina: opciones.limite,
  };
}
