export interface ProductoDTO {
  nombre: string;
  referencia: string;
  numStock: number;
  precioCent: number;
  descripcion: string;
  categoria: string;
  urlImagen: string;
}

export interface Producto extends ProductoDTO {
  id: string;
  activo: boolean;
}
