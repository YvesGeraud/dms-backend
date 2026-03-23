import { ErrorNoEncontrado, ErrorNegocio, ErrorDuplicado } from '@/utils/errores.utils';

/**
 * Ejecuta una query y lanza ErrorNoEncontrado si devuelve null.
 * Elimina el if-throw repetitivo en cada servicio.
 *
 * Uso: const platillo = await buscarOError(prisma.ct_platillo.findUnique(...), 'Platillo');
 */
export async function buscarOError<T>(promesa: Promise<T | null>, recurso = 'Recurso'): Promise<T> {
  const resultado = await promesa;
  if (!resultado) throw new ErrorNoEncontrado(recurso);
  return resultado;
}

// Para unicidad → ErrorDuplicado (409)
export async function verificarNoExiste<T>(
  promesa: Promise<T | null>,
  mensaje = 'El recurso ya existe',
): Promise<void> {
  if (await promesa) throw new ErrorDuplicado(mensaje);
}

// Para reglas de negocio → ErrorNegocio (422)
export async function verificarRegla<T>(
  promesa: Promise<T | null>,
  mensaje: string,
): Promise<void> {
  if (await promesa) throw new ErrorNegocio(mensaje);
}
