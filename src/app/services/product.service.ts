import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaginaProducto, ProductInfo, Producto } from '../models/producto.model';

export class ProductApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProductApiError';
  }
}

export type OrdenCatalogo = 'relevancia' | 'precioAsc' | 'precioDesc' | 'descuento';
export type EstadoProducto = 'todos' | 'activos' | 'inactivos';

export interface FiltrosProductos {
  busqueda?: string;
  categoriaId?: string;
  precioMinCent?: number | null;
  precioMaxCent?: number | null;
  soloOfertas?: boolean;
  orden?: string;
  estado?: EstadoProducto;
}

function paramsDeFiltros(filtros: FiltrosProductos, pagina: number, tamanoPagina: number): HttpParams {
  let params = new HttpParams();

  if (filtros.busqueda?.trim()) params = params.set('busqueda', filtros.busqueda.trim());
  if (filtros.categoriaId && filtros.categoriaId !== 'Todas' && filtros.categoriaId !== 'TODAS') {
    params = params.set('categoriaId', filtros.categoriaId);
  }
  if (filtros.precioMinCent != null) params = params.set('precioMinCent', filtros.precioMinCent);
  if (filtros.precioMaxCent != null) params = params.set('precioMaxCent', filtros.precioMaxCent);
  if (filtros.soloOfertas) params = params.set('soloOfertas', true);
  if (filtros.orden && filtros.orden !== 'relevancia') params = params.set('orden', filtros.orden);
  if (filtros.estado && filtros.estado !== 'todos') params = params.set('activo', filtros.estado === 'activos');
  return params.set('page', pagina).set('size', tamanoPagina);
}

// Garantiza el filtrado aunque el backend ignore algún parámetro.
export function filtrarProductos(productos: Producto[], filtros: FiltrosProductos): Producto[] {
  const texto = filtros.busqueda?.trim().toLowerCase();
  const categoriaId =
    filtros.categoriaId && filtros.categoriaId !== 'Todas' && filtros.categoriaId !== 'TODAS'
      ? filtros.categoriaId
      : null;

  const filtrados = productos.filter(
    (p) =>
      (!texto || p.nombre.toLowerCase().includes(texto) || p.referencia.toLowerCase().includes(texto)) &&
      (!categoriaId || p.categoriaId === categoriaId) &&
      (filtros.precioMinCent == null || p.precioCent >= filtros.precioMinCent) &&
      (filtros.precioMaxCent == null || p.precioCent <= filtros.precioMaxCent) &&
      (!filtros.soloOfertas || p.descuento > 0) &&
      (!filtros.estado || filtros.estado === 'todos' || p.activo === (filtros.estado === 'activos')),
  );

        const precioFinal = (p: Producto) => p.precioCent * (1 - (p.descuento || 0) / 100);
        switch (filtros.orden) {
          case 'precioAsc':
            return filtrados.sort((a, b) => precioFinal(a) - precioFinal(b));
          case 'precioDesc':
            return filtrados.sort((a, b) => precioFinal(b) - precioFinal(a));
          case 'descuento':
            return filtrados.sort((a, b) => (b.descuento || 0) - (a.descuento || 0));
          default:
            return filtrados;
        }
      }

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;

  obtenerDisponibles(filtros: FiltrosProductos = {}, pagina = 0, tamanoPagina = 36): Observable<PaginaProducto> {
    const params = paramsDeFiltros(filtros, pagina, tamanoPagina);

    return this.http.get<PaginaProducto>(`${this.apiUrl}/disponibles`, { params, withCredentials: true }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new ProductApiError(error.status, mensajeParaStatus(error)));
      }),
    );
  }

  obtenerInfo(id: string): Observable<ProductInfo> {
    return this.http.get<ProductInfo>(`${this.apiUrl}/${encodeURIComponent(id)}/info`, { withCredentials: true }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new ProductApiError(error.status, mensajeParaInfoProducto(error)));
      }),
    );
  }

  obtenerCatalogoVendedor(pagina = 0, tamanoPagina = 36, filtros: FiltrosProductos = {}): Observable<PaginaProducto> {
    const params = paramsDeFiltros(filtros, pagina, tamanoPagina).set('sort', 'activo,desc');

    return this.http.get<PaginaProducto>(`${this.apiUrl}/catalogo`, {
      params,
      withCredentials: true,
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new ProductApiError(error.status, mensajeParaCatalogoVendedor(error)));
      }),
    );
  }
}

function mensajeParaStatus(error: HttpErrorResponse): string {
  switch (error.status) {
    case 401:
      return 'Tu sesión no está autenticada o la cookie JWT no está disponible.';
    case 403:
      return 'Tu usuario está autenticado, pero no tiene permiso para ver el catálogo.';
    case 500:
      return 'El servidor no ha podido cargar el catálogo. Inténtalo de nuevo más tarde.';
    case 0:
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
    default:
      return `No se ha podido cargar el catálogo (HTTP ${error.status}).`;
  }
}

function mensajeParaInfoProducto(error: HttpErrorResponse): string {
  switch (error.status) {
    case 404:
      return 'No se ha encontrado el producto o ya no está disponible.';
    case 500:
      return 'No se ha podido cargar la información del producto. Inténtalo de nuevo más tarde.';
    case 0:
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
    default:
      return `No se ha podido cargar la información del producto (HTTP ${error.status}).`;
  }
}

function mensajeParaCatalogoVendedor(error: HttpErrorResponse): string {
  switch (error.status) {
    case 401:
      return 'Tu sesión no está autenticada o ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'No tienes permisos para consultar tus productos.';
    case 500:
      return 'El servidor no ha podido cargar tus productos. Inténtalo de nuevo más tarde.';
    case 0:
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
    default:
      return `No se han podido cargar tus productos (HTTP ${error.status}).`;
  }
}
