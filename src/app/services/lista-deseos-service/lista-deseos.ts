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

type AccionListaDeseos =
  | 'crear'
  | 'listar'
  | 'productos'
  | 'agregar'
  | 'eliminar'
  | 'eliminarLista'
  | 'modificar';

const MENSAJES_SIN_CONEXION: Record<AccionListaDeseos, string> = {
  crear: 'No se puede conectar con el servidor para crear la lista.',
  listar: 'No se puede conectar con el servidor para consultar tus listas de deseos.',
  productos: 'No se puede conectar con el servidor para consultar tus listas de deseos.',
  agregar: 'No se puede conectar con el servidor para guardar el producto en la lista.',
  eliminar: 'No se puede conectar con el servidor para eliminar el producto de la lista.',
  eliminarLista: 'No se puede conectar con el servidor para eliminar la lista de deseos.',
  modificar: 'No se puede conectar con el servidor para modificar la lista.',
};

const MENSAJES_SESION_CADUCADA: Record<AccionListaDeseos, string> = {
  crear: 'Tu sesión ha caducado. Inicia sesión de nuevo para crear la lista.',
  listar: 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar tus listas de deseos.',
  productos: 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar tus listas de deseos.',
  agregar: 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar productos en tus listas.',
  eliminar: 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar productos de tus listas.',
  eliminarLista: 'Tu sesión ha caducado. Inicia sesión de nuevo para eliminar la lista de deseos.',
  modificar: 'Tu sesión ha caducado. Inicia sesión de nuevo para modificar la lista.',
};

const MENSAJES_PERMISO_DENEGADO: Record<AccionListaDeseos, string> = {
  crear: 'Solo los clientes pueden crear listas de deseos.',
  listar: 'Solo los clientes pueden consultar listas de deseos.',
  productos: 'Solo los clientes pueden consultar listas de deseos.',
  agregar: 'Solo los clientes pueden guardar productos en listas de deseos.',
  eliminar: 'Solo los clientes pueden eliminar productos de listas de deseos.',
  eliminarLista: 'Solo los clientes pueden eliminar listas de deseos.',
  modificar: 'Solo los clientes pueden modificar listas de deseos.',
};

const MENSAJES_ERROR_SERVIDOR: Record<AccionListaDeseos, string> = {
  crear: 'No se ha podido crear la lista. Inténtalo de nuevo más tarde.',
  listar: 'No se han podido cargar tus listas de deseos. Inténtalo de nuevo más tarde.',
  productos: 'No se han podido cargar tus listas de deseos. Inténtalo de nuevo más tarde.',
  agregar: 'No se ha podido guardar el producto en la lista. Inténtalo de nuevo más tarde.',
  eliminar: 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo más tarde.',
  eliminarLista: 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo más tarde.',
  modificar: 'No se ha podido modificar la lista. Inténtalo de nuevo más tarde.',
};

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
    accion: AccionListaDeseos,
  ): ListaDeseosApiError {
    return new ListaDeseosApiError(error.status, this.mensajePara(error.status, accion));
  }

  private mensajePara(status: number, accion: AccionListaDeseos): string {
    if (status === 0) return MENSAJES_SIN_CONEXION[accion];
    if (status === 400) return this.mensajeSolicitudInvalida(accion);
    if (status === 401) return MENSAJES_SESION_CADUCADA[accion];
    if (status === 403) return MENSAJES_PERMISO_DENEGADO[accion];
    if (status === 404) return this.mensajeNoEncontrado(accion);
    return MENSAJES_ERROR_SERVIDOR[accion];
  }

  private mensajeSolicitudInvalida(accion: AccionListaDeseos): string {
    if (accion === 'eliminarLista') return 'No se ha podido eliminar la lista de deseos. Inténtalo de nuevo.';
    if (accion === 'eliminar') return 'No se ha podido eliminar el producto de la lista. Inténtalo de nuevo.';
    return 'Introduce un nombre válido para la lista.';
  }

  private mensajeNoEncontrado(accion: AccionListaDeseos): string {
    if (accion === 'agregar' || accion === 'eliminar') {
      return 'No se ha encontrado la lista o el producto. Actualiza tus listas e inténtalo de nuevo.';
    }
    if (accion === 'modificar' || accion === 'eliminarLista') {
      return 'No se ha encontrado la lista de deseos. Actualiza tus listas e inténtalo de nuevo.';
    }
    return 'No se ha encontrado esta lista de deseos.';
  }
}
