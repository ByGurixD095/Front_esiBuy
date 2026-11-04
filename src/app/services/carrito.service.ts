import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precioCent: number;
  urlImagen: string | null;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/carrito`;

  obtenerCarrito(): Observable<ItemCarrito[]> {
    return this.http.get<ItemCarrito[]>(this.apiUrl, { withCredentials: true });
  }

  anadirProducto(productoId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${encodeURIComponent(productoId)}`,
      {},
      { withCredentials: true },
    );
  }

  actualizarCantidad(productoId: string, cantidad: number): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${encodeURIComponent(productoId)}`,
      { cantidad },
      { withCredentials: true },
    );
  }

  eliminarProducto(productoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(productoId)}`, {
      withCredentials: true,
    });
  }

  vaciar(): Observable<void> {
    return this.http.delete<void>(this.apiUrl, { withCredentials: true });
  }
}
