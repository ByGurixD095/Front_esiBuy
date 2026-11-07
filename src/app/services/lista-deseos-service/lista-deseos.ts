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

  private convertir(
    error: HttpErrorResponse,
    accion: 'crear' | 'listar' | 'productos' | 'agregar' | 'eliminar' | 'eliminarLista' | 'modificar',
  ): ListaDeseosApiError {
    const mensaje = (() => {
      switch (error.status) {
        case 0:
          if (accion === 'crear') return 'No se puede conectar con el servidor para crear la lista.';
          if (accion === 'modificar') return 'No se puede conectar con el servidor para modificar la lista.';
          if (accion === 'agregar') return 'No se puede conectar con el servidor para guardar el producto en la lista.';
          if (accion === 'eliminarLista') return 'No se puede conectar con el servidor para eliminar la lista de deseos.';
          if (accion === 'eliminar') return 'No se puede conectar con el servidor para eliminar el producto de la lista.';
          return 'No se puede conectar con el servidor para consultar tus listas de deseos.';
        case 400:
          if (accion === 'eliminarLista') return 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo.';
          if (accion === 'eliminar') return 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo.';
          return 'Introduce un nombre válido para la lista.';
        case 401:
          if (accion === 'crear') return 'Tu sesión ha caducado. Inicia sesión de nuevo para crear la lista.';
          if (accion === 'modificar') return 'Tu sesión ha caducado. Inicia sesión de nuevo para modificar la lista.';
          if (accion === 'agregar') return 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar productos en tus listas.';
          if (accion === 'eliminarLista') return 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar la lista de deseos.';
          if (accion === 'eliminar') return 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar productos de tus listas.';
          return 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar tus listas de deseos.';
        case 403:
          if (accion === 'crear') return 'Solo los clientes pueden crear listas de deseos.';
          if (accion === 'modificar') return 'Solo los clientes pueden modificar listas de deseos.';
          if (accion === 'agregar') return 'Solo los clientes pueden guardar productos en listas de deseos.';
          if (accion === 'eliminarLista') return 'Solo los clientes pueden eliminar listas de deseos.';
          if (accion === 'eliminar') return 'Solo los clientes pueden eliminar productos de listas de deseos.';
          return 'Solo los clientes pueden consultar listas de deseos.';
        case 404:
          if (accion === 'agregar' || accion === 'eliminar') {
            return 'No se ha encontrado la lista o el producto. Actualiza tus listas e inténtalo de nuevo.';
          }
          if (accion === 'modificar' || accion === 'eliminarLista') {
            return 'No se ha encontrado la lista de deseos. Actualiza tus listas e inténtalo de nuevo.';
          }
          return 'No se ha encontrado esta lista de deseos.';
        default:
          if (accion === 'crear') return 'No se ha podido crear la lista. Inténtalo de nuevo más tarde.';
          if (accion === 'modificar') return 'No se ha podido modificar la lista. Inténtalo de nuevo más tarde.';
          if (accion === 'agregar') return 'No se ha podido guardar el producto en la lista. Inténtalo de nuevo más tarde.';
          if (accion === 'eliminarLista') return 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo más tarde.';
          if (accion === 'eliminar') return 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo más tarde.';
          return 'No se han podido cargar tus listas de deseos. Inténtalo de nuevo más tarde.';
      }
    })();

    return new ListaDeseosApiError(error.status, mensaje);
  }
}
