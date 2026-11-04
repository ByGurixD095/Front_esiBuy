import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DireccionEnvio } from './pedidos.service';

export interface DireccionGuardada extends DireccionEnvio {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class DireccionesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users/me/direcciones`;

  listar(): Observable<DireccionGuardada[]> {
    return this.http.get<DireccionGuardada[]>(this.apiUrl, { withCredentials: true });
  }

  crear(direccion: DireccionEnvio): Observable<DireccionGuardada> {
    return this.http.post<DireccionGuardada>(this.apiUrl, direccion, { withCredentials: true });
  }

  actualizar(id: string, direccion: DireccionEnvio): Observable<DireccionGuardada> {
    return this.http.put<DireccionGuardada>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      direccion,
      { withCredentials: true },
    );
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
      withCredentials: true,
    });
  }
}
