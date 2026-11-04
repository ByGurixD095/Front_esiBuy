import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Producto } from '../../models/producto.model';
import {
  ListaDeseos,
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-listas-deseos',
  imports: [RouterLink, MarcoPagina],
  templateUrl: './listas-deseos.html',
  styleUrl: './listas-deseos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListasDeseos implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly listasService = inject(ListaDeseosService);

  readonly listas = signal<ListaDeseos[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly idLista = signal<string | null>(null);
  readonly listaSeleccionada = computed(
    () => this.listas().find((lista) => lista.id === this.idLista()) ?? null,
  );
  readonly cargandoListas = signal(true);
  readonly cargandoProductos = signal(false);
  readonly errorListas = signal<string | null>(null);
  readonly errorProductos = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.cargar(params.get('id')));
  }

  cargar(idLista: string | null = this.idLista()): void {
    this.idLista.set(idLista);
    this.cargandoListas.set(true);
    this.cargandoProductos.set(false);
    this.errorListas.set(null);
    this.errorProductos.set(null);
    this.productos.set([]);

    this.listasService.listar().subscribe({
      next: (listas) => {
        this.listas.set(listas);
        this.cargandoListas.set(false);
        if (idLista) this.cargarProductos(idLista);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorListas.set(error.message);
        this.cargandoListas.set(false);
      },
    });
  }

  formatearPrecio(precioCent: number, descuento = 0): string {
    const precioFinal = Math.round(precioCent * (1 - descuento / 100));
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
      precioFinal / 100,
    );
  }

  private cargarProductos(idLista: string): void {
    this.cargandoProductos.set(true);
    this.listasService.obtenerProductos(idLista).subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargandoProductos.set(false);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorProductos.set(error.message);
        this.cargandoProductos.set(false);
      },
    });
  }
}
