// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Resultado de una operación batch.
 * Siempre devuelve el conteo y los errores, incluso si algunos items fallaron,
 * para que el cliente sepa exactamente qué se procesó y qué no.
 */
export interface ResultadoBatch<TError = unknown> {
  procesados: number;
  exitosos: number;
  fallidos: number;
  errores: ErrorBatch<TError>[];
}

export interface ErrorBatch<T = unknown> {
  indice: number; // posición del item en el array original
  error: string;
  dato?: T; // el item que falló (útil para reintentar)
}

export interface OpcionesBatch {
  /** Cuántos items se procesan por lote. Default: 100 */
  tamanioLote?: number;
  /** Si es true, detiene al primer lote con error. Default: false (modo tolerante) */
  detenerEnError?: boolean;
}

// ── Utilidad principal ────────────────────────────────────────────────────────

/**
 * Divide un array grande en lotes y aplica un procesador a cada uno.
 * Diseñado para operaciones masivas hacia la BD sin saturar el pool de conexiones.
 *
 * @param items      - Array completo de datos a procesar
 * @param procesador - Función async que recibe un lote y devuelve los resultados
 * @param opciones   - Tamaño de lote y comportamiento ante errores
 *
 * @example
 * // Crear 500 usuarios en lotes de 50
 * const resultado = await procesarEnLotes(
 *   usuariosDTO,
 *   (lote) => prisma.ct_usuario.createMany({ data: lote, skipDuplicates: true }),
 *   { tamanioLote: 50 },
 * );
 * console.log(`${resultado.exitosos} creados, ${resultado.fallidos} fallidos`);
 */
export async function procesarEnLotes<TInput, TOutput>(
  items: TInput[],
  procesador: (lote: TInput[], offsetLote: number) => Promise<TOutput>,
  opciones: OpcionesBatch = {},
): Promise<ResultadoBatch<TInput> & { resultados: TOutput[] }> {
  const { tamanioLote = 100, detenerEnError = false } = opciones;

  const resultados: TOutput[] = [];
  const errores: ErrorBatch<TInput>[] = [];
  let exitosos = 0;

  // Procesamos lote por lote en secuencia para no saturar el pool de conexiones.
  // Si se necesita máximo paralelismo, cambiar a Promise.all (con cuidado).
  for (let i = 0; i < items.length; i += tamanioLote) {
    const lote = items.slice(i, i + tamanioLote);

    try {
      const resultado = await procesador(lote, i);
      resultados.push(resultado);
      exitosos += lote.length;
    } catch (err) {
      // Registramos todos los items del lote fallido con su índice original
      lote.forEach((dato, j) => {
        errores.push({
          indice: i + j,
          error: err instanceof Error ? err.message : String(err),
          dato,
        });
      });

      if (detenerEnError) break;
    }
  }

  return {
    procesados: items.length,
    exitosos,
    fallidos: errores.length,
    errores,
    resultados,
  };
}

// ── Helper para Prisma createMany ─────────────────────────────────────────────

/**
 * Versión simplificada para el caso más común: insertar muchos registros con Prisma.
 * Usa `skipDuplicates: true` por defecto para que sea idempotente.
 *
 * Devuelve directamente el conteo, sin la carga de los resultados completos,
 * porque `createMany` en Prisma no devuelve los registros creados.
 *
 * @example
 * const { exitosos, fallidos } = await insertarEnLotes(
 *   prisma.ct_platillo,
 *   platillosData,
 *   { tamanioLote: 50 },
 * );
 */
export async function insertarEnLotes<TData>(
  modelo: {
    createMany: (args: { data: TData[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  },
  datos: TData[],
  opciones: OpcionesBatch & { skipDuplicates?: boolean } = {},
): Promise<ResultadoBatch> {
  const { skipDuplicates = true, ...opcionesBatch } = opciones;

  const resultado = await procesarEnLotes(
    datos,
    (lote) => modelo.createMany({ data: lote, skipDuplicates }),
    opcionesBatch,
  );

  // createMany devuelve { count } por lote — sumamos el total real insertado
  const totalInsertados = resultado.resultados.reduce((acc, r) => acc + r.count, 0);

  return {
    procesados: resultado.procesados,
    exitosos: totalInsertados,
    fallidos: resultado.fallidos,
    errores: resultado.errores,
  };
}

// ── Helper para dividir arrays ────────────────────────────────────────────────

/**
 * Divide un array en subarrays del tamaño indicado.
 * Útil cuando necesitas controlar manualmente la división fuera de procesarEnLotes.
 *
 * @example
 * const lotes = dividirEnLotes([1,2,3,4,5], 2); // [[1,2],[3,4],[5]]
 */
export function dividirEnLotes<T>(items: T[], tamanio: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamanio) {
    lotes.push(items.slice(i, i + tamanio));
  }
  return lotes;
}
