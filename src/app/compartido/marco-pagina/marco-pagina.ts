import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Marco común de las pantallas: cabecera con logo, contenido proyectado y pie. */
@Component({
  selector: 'app-marco-pagina',
  imports: [RouterLink],
  templateUrl: './marco-pagina.html',
  styleUrl: './marco-pagina.css',
})
export class MarcoPagina {
  /** Etiqueta del panel junto al logo (p. ej. "Panel de administración"). Vacía = sin etiqueta. */
  readonly panel = input('');
  /** Muestra el enlace "Volver a la tienda" en la cabecera. */
  readonly volver = input(false);
}
