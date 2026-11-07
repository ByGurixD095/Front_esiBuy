import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, Rol } from '../../services/auth.service';

/** Marco común de las pantallas: cabecera con logo, contenido proyectado y pie. */
@Component({
  selector: 'app-marco-pagina',
  imports: [RouterLink],
  templateUrl: './marco-pagina.html',
  styleUrl: './marco-pagina.css',
})
export class MarcoPagina {
  readonly auth = inject(AuthService);
  /** Etiqueta del panel junto al logo (p. ej. "Panel de administración"). Vacía = sin etiqueta. */
  readonly panel = input('');
  /** Muestra el enlace "Inicio" en la cabecera. */
  readonly volver = input(false);

  estaAutenticado(): boolean {
    return typeof this.auth.isAuthenticated === 'function' && this.auth.isAuthenticated();
  }

  tieneRol(roles: readonly Rol[]): boolean {
    return typeof this.auth.hasRole === 'function' && this.auth.hasRole(roles);
  }

}
