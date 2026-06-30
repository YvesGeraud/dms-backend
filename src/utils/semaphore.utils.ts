import { ErrorServicioOcupado } from '@/utils/errores.utils';

/**
 * Semáforo en proceso para limitar trabajos pesados concurrentes (e.g., generación de ZIPs).
 * Cuando el límite está lleno, lanza ErrorServicioOcupado (503) en lugar de encolar,
 * para evitar HTTP connections colgadas esperando indefinidamente.
 */
export class Semaphore {
  private activos = 0;

  constructor(
    private readonly max: number,
    private readonly mensajeError: string,
    private readonly retryAfterSegundos = 30,
  ) {}

  async run<T>(tarea: () => Promise<T>): Promise<T> {
    if (this.activos >= this.max) {
      throw new ErrorServicioOcupado(this.mensajeError, this.retryAfterSegundos);
    }
    this.activos++;
    try {
      return await tarea();
    } finally {
      this.activos--;
    }
  }

  get disponibles(): number {
    return this.max - this.activos;
  }
}
