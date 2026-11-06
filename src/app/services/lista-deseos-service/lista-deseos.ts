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

  agregarProducto(idLista: string, idProducto: string): Observable<ListaDeseos> {
    return this.http
      .post<ListaDeseos>(
        `${this.apiUrl}/${encodeURIComponent(idLista)}/productos/${encodeURIComponent(idProducto)}`,
        {},
        { withCredentials: true },
      )
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.convertir(error, 'agregar'))));
  }

  private convertir(
    error: HttpErrorResponse,
    accion: 'crear' | 'listar' | 'productos' | 'agregar' | 'modificar',
  ): ListaDeseosApiError {
    switch (error.status) {
      case 0:
        return new ListaDeseosApiError(
          error.status,
          accion === 'crear'
            ? 'No se puede conectar con el servidor para crear la lista.'
            : accion === 'agregar'
              ? 'No se puede conectar con el servidor para guardar el producto en la lista.'
              : accion === 'modificar'
                ? 'No se puede conectar con el servidor para modificar la lista de deseos.'
              : 'No se puede conectar con el servidor para consultar tus listas de deseos.',
        );
      case 400:
        return new ListaDeseosApiError(
          error.status,
          accion === 'modificar' || accion === 'crear'
            ? 'Introduce un nombre válido para la lista.'
            : 'No se ha podido completar la operación.',
        );
      case 401:
        return new ListaDeseosApiError(
          error.status,
          accion === 'crear'
            ? 'Tu sesión ha caducado. Inicia sesión de nuevo para crear la lista.'
            : accion === 'agregar'
              ? 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar productos en tus listas.'
              : accion === 'modificar'
                ? 'Tu sesión ha caducado. Inicia sesión de nuevo para modificar la lista.'
              : 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar tus listas de deseos.',
        );
      case 403:
        return new ListaDeseosApiError(
          error.status,
          accion === 'crear'
            ? 'Solo los clientes pueden crear listas de deseos.'
            : accion === 'agregar'
              ? 'Solo los clientes pueden guardar productos en listas de deseos.'
              : accion === 'modificar'
                ? 'Solo los clientes pueden modificar listas de deseos.'
              : 'Solo los clientes pueden consultar listas de deseos.',
        );
      case 404:
        return new ListaDeseosApiError(
          error.status,
          accion === 'agregar'
            ? 'No se ha encontrado la lista o el producto. Actualiza tus listas e inténtalo de nuevo.'
            : 'No se ha encontrado esta lista de deseos.',
        );
      default:
        return new ListaDeseosApiError(
          error.status,
          accion === 'crear'
            ? 'No se ha podido crear la lista. Inténtalo de nuevo más tarde.'
            : accion === 'agregar'
              ? 'No se ha podido guardar el producto en la lista. Inténtalo de nuevo más tarde.'
              : accion === 'modificar'
                ? 'No se ha podido modificar la lista de deseos. Inténtalo de nuevo más tarde.'
              : 'No se han podido cargar tus listas de deseos. Inténtalo de nuevo más tarde.',
        );
    }
  }
}
