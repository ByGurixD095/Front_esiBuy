import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = 'http://localhost:8080';

export interface NuevaCategoria {
  nombre: string;
  activo: boolean;
}

export interface CategoriaCreada extends NuevaCategoria {
  id: string;
}

@Injectable({
  providedIn: 'root',
})
export class Categorias {
  private readonly http = inject(HttpClient);

  crear(datos: NuevaCategoria): Observable<CategoriaCreada> {
    return this.http.post<CategoriaCreada>(`${API_URL}/admin/categorias`, datos, {
      withCredentials: true,
    });
  }
}
