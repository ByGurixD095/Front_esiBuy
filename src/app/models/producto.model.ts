export interface ProductoDTO {
  nombre: string;
  referencia: string;
  numStock: number;
  precioCent: number;
  descripcion?: string | null;
  categoria: string;
  urlImagen?: string | null;
  descuento: number;
  descuentoPremium: number;
  activo: boolean;
}

export interface Producto extends ProductoDTO {
  id: string;
}
