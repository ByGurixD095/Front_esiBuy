export interface ProductoDTO {
  nombre: string;
  referencia: string;
  numStock: number;
  precioCent: number;
  descripcion?: string | null;
  categoriaId: string;
  urlImagen?: string | null;
  descuento: number;
  descuentoPremium: number;
  activo: boolean;
  soloPremium?: boolean;
}
// Deveria ir en el service al inicio
export interface Producto extends ProductoDTO {
  id: string;
  categoria: string;
}

export interface ProductInfo {
  nombre: string;
  numStock: number;
  precioCent: number;
  descripcion: string | null;
  categoria: string;
  urlImagen: string | null;
  descuento: number;
  descuentoPremium: number;
  soloPremium?: boolean;
  vendedor: string;
  mediaEstrellas?: number;
  valoraciones?: Valoracion[];
  puedeValorar?: boolean;
}

export interface Valoracion {
  nombreUsuario: string;
  estrellas: number;
  texto: string;
  fecha: string | null;
}

export interface PaginaProducto {
  content: Producto[];
  totalElements: number;
  totalPages: number;
  number: number;
}