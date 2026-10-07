import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Producto, ProductoDTO } from '../models/producto.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;

  crearProducto(producto: ProductoDTO): Observable<Producto> {
    return this.http.post<Producto>(this.apiUrl, producto).pipe(
      catchError((error: HttpErrorResponse) => {
        let mensaje = 'Se ha producido un error inesperado al crear el producto.';

        if (error.status === 0) {
          mensaje = 'No se puede conectar con el backend. Comprueba que Spring Boot esté ejecutándose en http://localhost:8080 y que CORS permita http://localhost:4200.';
        } else if (typeof error.error === 'string' && error.error.trim()) {
          mensaje = `Error ${error.status}: ${error.error}`;
        } else if (typeof error.error === 'object' && error.error !== null) {
          const backendError = error.error as { mensaje?: unknown; message?: unknown };

          if (typeof backendError.mensaje === 'string') {
            mensaje = backendError.mensaje;
          } else if (typeof backendError.message === 'string') {
            mensaje = backendError.message;
          } else {
            mensaje = `Error ${error.status}: ${error.statusText || 'el backend rechazó la petición.'}`;
          }
        } else {
          mensaje = `Error ${error.status}: ${error.statusText || 'el backend rechazó la petición.'}`;
        }

        return throwError(() => new Error(mensaje));
      }),
    );
  }
}
