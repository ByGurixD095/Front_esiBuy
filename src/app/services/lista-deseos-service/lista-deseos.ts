import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Producto } from '../../models/producto.model';

export interface ListaDeseos {
  id: string;
  idCliente: string;
  nombre: string;
  productosIds: string[];
}

export class ListaDeseosApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ListaDeseosApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ListaDeseosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/listas-deseos`;

  listar(): Observable<ListaDeseos[]> {
    return this.http
      .get<ListaDeseos[]>(this.apiUrl, { withCredentials: true })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'listar'))));
  }

  obtenerProductos(idLista: string): Observable<Producto[]> {
    return this.http
      .get<Producto[]>(`${this.apiUrl}/${encodeURIComponent(idLista)}/productos`, { withCredentials: true })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'productos'))));
  }

  crear(nombre: string): Observable<ListaDeseos> {
    return this.http
      .post<ListaDeseos>(this.apiUrl, { nombre }, { withCredentials: true })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'crear'))));
  }

  modificarLista(idLista: string, nombre: string): Observable<ListaDeseos> {
    return this.http
      .put<ListaDeseos>(
        `${this.apiUrl}/${encodeURIComponent(idLista)}`,
        { nombre },
        { withCredentials: true },
      )
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'modificar'))));
  }

  eliminarLista(idLista: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${encodeURIComponent(idLista)}`, { withCredentials: true })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'eliminarLista'))));
  }

  agregarProducto(idLista: string, idProducto: string): Observable<ListaDeseos> {
    return this.http
      .post<ListaDeseos>(
        `${this.apiUrl}/${encodeURIComponent(idLista)}/productos/${encodeURIComponent(idProducto)}`,
        {},
        { withCredentials: true },
      )
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'agregar'))));
  }

  eliminarProducto(idLista: string, idProducto: string): Observable<void> {
    return this.http
      .delete<void>(
        `${this.apiUrl}/${encodeURIComponent(idLista)}/productos/${encodeURIComponent(idProducto)}`,
        { withCredentials: true },
      )
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'eliminar'))));
  }

  private static readonly MENSAJES_ERROR: Record<number | string, Record<string, string>> = {
    0: {
      crear: 'No se puede conectar con el servidor para crear la lista.',
      modificar: 'No se puede conectar con el servidor para modificar la lista.',
      agregar: 'No se puede conectar con el servidor para guardar el producto en la lista.',
      eliminarLista: 'No se puede conectar con el servidor para eliminar la lista de deseos.',
      eliminar: 'No se puede conectar con el servidor para eliminar el producto de la lista.',
      default: 'No se puede conectar con el servidor para consultar tus listas de deseos.',
    },
    400: {
      eliminarLista: 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo.',
      eliminar: 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo.',
      default: 'Introduce un nombre válido para la lista.',
    },
    401: {
      crear: 'Tu sesión ha caducado. Inicia sesión de nuevo para crear la lista.',
      modificar: 'Tu sesión ha caducado. Inicia sesión de nuevo para modificar la lista.',
      agregar: 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar productos en tus listas.',
      eliminarLista: 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar la lista de deseos.',
      eliminar: 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar productos de tus listas.',
      default: 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar tus listas de deseos.',
    },
    403: {
      crear: 'Solo los clientes pueden crear listas de deseos.',
      modificar: 'Solo los clientes pueden modificar listas de deseos.',
      agregar: 'Solo los clientes pueden guardar productos en listas de deseos.',
      eliminarLista: 'Solo los clientes pueden eliminar listas de deseos.',
      eliminar: 'Solo los clientes pueden eliminar productos de listas de deseos.',
      default: 'Solo los clientes pueden consultar listas de deseos.',
    },
    404: {
      agregar: 'No se ha encontrado la lista o el producto. Actualiza tus listas e inténtalo de nuevo.',
      eliminar: 'No se ha encontrado la lista o el producto. Actualiza tus listas e inténtalo de nuevo.',
      modificar: 'No se ha encontrado la lista de deseos. Actualiza tus listas e inténtalo de nuevo.',
      eliminarLista: 'No se ha podido encontrar la lista de deseos. Actualiza tus listas e inténtalo de nuevo.',
      default: 'No se ha encontrado esta lista de deseos.',
    },
    default: {
      crear: 'No se ha podido crear la lista. Inténtalo de nuevo más tarde.',
      modificar: 'No se ha podido modificar la lista. Inténtalo de nuevo más tarde.',
      agregar: 'No se ha podido guardar el producto en la lista. Inténtalo de nuevo más tarde.',
      eliminarLista: 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo más tarde.',
      eliminar: 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo más tarde.',
      default: 'No se han podido cargar tus listas de deseos. Inténtalo de nuevo más tarde.',
    },
  };

  private convertir(
    error: HttpErrorResponse,
    accion: 'crear' | 'listar' | 'productos' | 'agregar' | 'eliminar' | 'eliminarLista' | 'modificar',
  ): ListaDeseosApiError {
    const mapaStatus = ListaDeseosService.MENSAJES_ERROR[error.status] ?? ListaDeseosService.MENSAJES_ERROR['default'];
    const mensaje = mapaStatus[accion] ?? mapaStatus['default'];
    return new ListaDeseosApiError(error.status, mensaje);
  }
}