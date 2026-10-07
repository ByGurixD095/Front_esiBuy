import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Producto, ProductoDTO } from '../models/producto.model';
import { environment } from '../../environments/environment';

export class ProductoApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProductoApiError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products/createProduct`;

  crearProducto(producto: ProductoDTO): Observable<Producto> {
    const payload = {
      ...producto,
      precioCent: toNumberOrZero(producto.precioCent),
      descuento: toNumberOrZero(producto.descuento),
      descuentoPremium: toNumberOrZero(producto.descuentoPremium),
      descripcion: producto.descripcion?.trim() || null,
      urlImagen: producto.urlImagen?.trim() || null,
    };

    return this.http.post<Producto>(this.apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new ProductoApiError(error.status, mensajeParaStatus(error)));
      }),
    );
  }
}

function toNumberOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function mensajeParaStatus(error: HttpErrorResponse): string {
  switch (error.status) {
    case 400:
      return 'Revisa los datos del producto';
    case 401:
      return 'La sesión ha caducado. Inicia sesión de nuevo';
    case 403:
      return 'No tienes permisos para realizar esta acción';
    case 500:
      return 'Error interno del servidor';
    case 0:
      return 'No se puede conectar con el backend. Comprueba que Spring Boot esté ejecutándose en http://localhost:8080.';
    default:
      return extraerMensajeBackend(error, `Error ${error.status}: el backend rechazó la petición.`);
  }
}

function extraerMensajeBackend(error: HttpErrorResponse, mensajePorDefecto: string): string {
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error;
  }

  if (typeof error.error === 'object' && error.error !== null) {
    const backendError = error.error as { mensaje?: unknown; message?: unknown; error?: unknown };

    if (typeof backendError.mensaje === 'string' && backendError.mensaje.trim()) {
      return backendError.mensaje;
    }
    if (typeof backendError.message === 'string' && backendError.message.trim()) {
      return backendError.message;
    }
    if (typeof backendError.error === 'string' && backendError.error.trim()) {
      return backendError.error;
    }
  }

  return mensajePorDefecto;
}
