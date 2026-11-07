import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, Rol } from '../../services/auth.service';
import { CarritoService } from '../../services/carrito.service';

/** Marco común de las pantallas: cabecera con logo, contenido proyectado y pie. */
@Component({
  selector: 'app-marco-pagina',
  imports: [RouterLink],
  templateUrl: './marco-pagina.html',
  styleUrl: './marco-pagina.css',
})
export class MarcoPagina implements OnInit {
  readonly auth = inject(AuthService);
  private readonly carritoService = inject(CarritoService);

  /** Etiqueta del panel junto al logo (p. ej. "Panel de administración"). Vacía = sin etiqueta. */
  readonly panel = input('');
  /** Muestra el enlace "Inicio" en la cabecera. */
  readonly volver = input(false);
  /** Contador proporcionado por una pantalla que ya controla el estado de la cesta. */
  readonly cantidadCarrito = input<number | null | undefined>(undefined);

  readonly cantidadEnCarrito = signal<number | null>(null);
  readonly cantidadCestaVisible = computed(() => this.cantidadCarrito() ?? this.cantidadEnCarrito());

  ngOnInit(): void {
    if (this.cantidadCarrito() === undefined && this.tieneRol(['CLIENTE'])) {
      this.carritoService.obtenerCarrito().subscribe({
        next: (items) => {
          this.cantidadEnCarrito.set(items.reduce((total, item) => total + item.cantidad, 0));
        },
        error: () => this.cantidadEnCarrito.set(null)
      });
    }
  }

  estaAutenticado(): boolean {
    return typeof this.auth.isAuthenticated === 'function' && this.auth.isAuthenticated();
  }

  tieneRol(roles: readonly Rol[]): boolean {
    return typeof this.auth.hasRole === 'function' && this.auth.hasRole(roles);
  }
}