import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// Cargar variables de entorno
const env = dotenv.config();
dotenvExpand.expand(env);

export const configuracionServidor = {
  puerto: parseInt(process.env.PORT || "3000", 10),
  entorno: process.env.NODE_ENV || "development",

  cors: {
    origenes: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:4200",
    ],
  },

  jwt: {
    secreto: process.env.JWT_SECRET || "secreto-por-defecto-cambiar",
    expiracion: process.env.JWT_EXPIRES_IN || "24h",
  },

  restaurante: {
    tasaImpuesto: parseFloat(process.env.TASA_IMPUESTO || "0.16"),
    propinaSugerida: parseFloat(process.env.PROPINA_SUGERIDA || "0.10"),
  },

  estaEnProduccion: () => process.env.NODE_ENV === "production",
  estaEnDesarrollo: () => process.env.NODE_ENV === "development",
};

export default configuracionServidor;