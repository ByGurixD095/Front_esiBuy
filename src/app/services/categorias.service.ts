import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NuevaCategoria {
  nombre: string;
}

export interface CategoriaCreada extends NuevaCategoria {
  id: string;
}

export interface Categoria {
  id: string;
  nombre: string;
}

export function normalizarNombreCategoria(nombre: string): string {
  const normalizado = nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-ES');
  if (!normalizado) return '';

  const [primeraLetra, ...resto] = normalizado;
  return primeraLetra.toLocaleUpperCase('es-ES') + resto.join('');
}

@Injectable({
  providedIn: 'root',
})
export class Categorias {
  private readonly http = inject(HttpClient);

  crear(datos: NuevaCategoria): Observable<CategoriaCreada> {
    return this.http.post<CategoriaCreada>(
      `${environment.apiUrl}/admin/categorias`,
      { nombre: normalizarNombreCategoria(datos.nombre) },
      { withCredentials: true },
    );
  }

  actualizar(id: string, datos: NuevaCategoria): Observable<Categoria> {
    return this.http.put<Categoria>(
      `${environment.apiUrl}/admin/categorias/${encodeURIComponent(id)}`,
      { nombre: normalizarNombreCategoria(datos.nombre) },
      { withCredentials: true },
    );
  }

  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${environment.apiUrl}/categorias`, {
      withCredentials: true,
    });
  }
  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/admin/categorias/${encodeURIComponent(id)}`,
      { withCredentials: true },
    );
  }
}
