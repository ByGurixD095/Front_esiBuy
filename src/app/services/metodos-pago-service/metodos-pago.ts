import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TipoMetodoPago = 'TARJETA' | 'PAYPAL' | 'BIZUM';

export interface MetodoPago {
  id: string;
  tipo: TipoMetodoPago;
  alias: string;
  referencia: string;
  titular?: string | null;
  caducidad?: string | null;
}

export interface RegistrarMetodoPagoRequest {
  tipo: TipoMetodoPago;
  alias: string;
  titular: string;
  numeroTarjeta?: string;
  caducidad?: string;
  correoPayPal?: string;
  telefonoBizum?: string;
}

@Injectable({ providedIn: 'root' })
export class MetodosPagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users/me/metodoPago`;

  listar(): Observable<MetodoPago[]> {
    return this.http.get<MetodoPago[]>(this.apiUrl);
  }

  registrar(datos: RegistrarMetodoPagoRequest): Observable<MetodoPago> {
    return this.http.post<MetodoPago>(this.apiUrl, datos);
  }

  modificar(id: string, datos: RegistrarMetodoPagoRequest): Observable<MetodoPago> {
    return this.http.put<MetodoPago>(`${this.apiUrl}/${encodeURIComponent(id)}`, datos);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
