/**
 * Estructura estandarizada de respuesta API
 */
export interface RespuestaApi<T = any> {
    exito: boolean;
    mensaje: string;
    datos?: T;
    meta?: MetaRespuesta;
  }
  
  /**
   * Metadatos adicionales para respuestas (paginación, etc.)
   */
  export interface MetaRespuesta {
    paginaActual?: number;
    totalPaginas?: number;
    totalRegistros?: number;
    registrosPorPagina?: number;
    [key: string]: any;
  }
  
  /**
   * Estructura de error estandarizada
   */
  export interface RespuestaError {
    exito: false;
    mensaje: string;
    errores?: ErrorDetalle[];
    stack?: string; // Solo en desarrollo
  }
  
  /**
   * Detalle de errores de validación
   */
  export interface ErrorDetalle {
    campo?: string;
    mensaje: string;
    codigo?: string;
  }
  
  /**
   * Opciones de paginación
   */
  export interface OpcionesPaginacion {
    pagina: number;
    limite: number;
    ordenarPor?: string;
    orden?: "asc" | "desc";
  }
  
  /**
   * Resultado paginado
   */
  export interface ResultadoPaginado<T> {
    datos: T[];
    paginaActual: number;
    totalPaginas: number;
    totalRegistros: number;
    registrosPorPagina: number;
  }