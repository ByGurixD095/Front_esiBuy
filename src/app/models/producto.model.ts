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
  vendedor: string;
}

export interface PaginaProducto {
  content: Producto[];
  totalElements: number;
  totalPages: number;
  number: number;
}
