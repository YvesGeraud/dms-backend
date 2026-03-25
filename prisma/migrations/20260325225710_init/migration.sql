-- CreateTable
CREATE TABLE `ct_tipo_documento` (
    `id_ct_tipo_documento` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(50) NOT NULL DEFAULT '',
    `descripcion` VARCHAR(255) NOT NULL DEFAULT '',
    `max_size_bytes` INTEGER NOT NULL,
    `extensiones_permitidas` VARCHAR(255) NOT NULL DEFAULT 'pdf,jpg,png',
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `modulo` VARCHAR(100) NOT NULL,
    `fecha_in` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_up` DATETIME(0) NULL,
    `id_ct_usuario_in` INTEGER NOT NULL,
    `id_ct_usuario_up` INTEGER NULL,

    UNIQUE INDEX `clave`(`clave`),
    INDEX `ct_usuario_in`(`id_ct_usuario_in`),
    INDEX `ct_usuario_up`(`id_ct_usuario_up`),
    INDEX `estado`(`estado`),
    PRIMARY KEY (`id_ct_tipo_documento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dt_documento` (
    `id_dt_documento` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_original` VARCHAR(255) NOT NULL,
    `nombre_sistema` VARCHAR(255) NOT NULL,
    `ruta_relativa` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `tamaño_bytes` INTEGER NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `id_ct_tipo_documento` INTEGER NOT NULL,
    `id_ct_usuario` INTEGER NOT NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `fecha_in` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_up` DATETIME(0) NULL,
    `id_ct_usuario_in` INTEGER NOT NULL,
    `id_ct_usuario_up` INTEGER NULL,

    INDEX `idx_hash`(`hash`),
    INDEX `estado`(`estado`),
    INDEX `idx_id_ct_tipo_documento`(`id_ct_tipo_documento`),
    INDEX `idx_id_ct_usuario`(`id_ct_usuario`),
    INDEX `id_ct_usuario_in`(`id_ct_usuario_in`),
    INDEX `id_ct_usuario_up`(`id_ct_usuario_up`),
    PRIMARY KEY (`id_dt_documento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dt_documento` ADD CONSTRAINT `fk_dt_documento_tipo` FOREIGN KEY (`id_ct_tipo_documento`) REFERENCES `ct_tipo_documento`(`id_ct_tipo_documento`) ON DELETE RESTRICT ON UPDATE CASCADE;
