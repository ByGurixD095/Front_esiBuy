import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Producto } from '../../models/producto.model';
import { Favoritos, FavoritosApiError } from '../../services/favoritos-service/favoritos';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

/** HU 15: listado "Mis favoritos" del cliente, con opción de quitar cada producto. */
@Component({
  selector: 'app-mis-favoritos',
  imports: [RouterLink, MarcoPagina],
  templateUrl: './favoritos.html',
  styleUrl: './favoritos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisFavoritos implements OnInit {
  private readonly favoritosService = inject(Favoritos);

  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorQuitar = signal<string | null>(null);
  readonly quitando = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.favoritosService.listar().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (error: FavoritosApiError) => {
        this.error.set(error.message);
        this.cargando.set(false);
      },
    });
  }

  quitar(producto: Producto): void {
    if (this.quitando().has(producto.id)) return;
    this.errorQuitar.set(null);
    this.quitando.update((ids) => new Set(ids).add(producto.id));

    this.favoritosService.quitar(producto.id).subscribe({
      next: () => {
        this.productos.update((lista) => lista.filter((p) => p.id !== producto.id));
        this.terminarQuitar(producto.id);
      },
      error: (error: FavoritosApiError) => {
        this.errorQuitar.set(error.message);
        this.terminarQuitar(producto.id);
      },
    });
  }

  estaQuitando(id: string): boolean {
    return this.quitando().has(id);
  }

  formatearPrecio(precioCent: number, descuento = 0): string {
    const final = Math.floor(precioCent * (1 - descuento / 100));
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(final / 100);
  }

  private terminarQuitar(id: string): void {
    this.quitando.update((ids) => {
      const siguiente = new Set(ids);
      siguiente.delete(id);
      return siguiente;
    });
  }
}
