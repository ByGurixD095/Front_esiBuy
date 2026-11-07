import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  imports: [ReactiveFormsModule, RouterLink, MarcoPagina],
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
  readonly listaPendienteEliminar = signal<ListaDeseos | null>(null);
  readonly errorEliminacionLista = signal<string | null>(null);
  readonly eliminandoLista = signal(false);
  readonly errorEliminacion = signal<string | null>(null);
  readonly productoPendienteEliminacion = signal<Producto | null>(null);
  readonly eliminandoProductoId = signal<string | null>(null);
  readonly listaPendienteModificacion = signal<ListaDeseos | null>(null);
  readonly guardandoModificacion = signal(false);
  readonly errorModificacion = signal<string | null>(null);
  readonly formularioNombre = new FormGroup({
    nombre: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.cargar(params.get('id')));
  }

  cargar(idLista: string | null = this.idLista()): void {
    this.idLista.set(idLista);
    this.cargandoListas.set(true);
    this.cargandoProductos.set(false);
    this.errorListas.set(null);
    this.errorProductos.set(null);
    this.listaPendienteEliminar.set(null);
    this.errorEliminacionLista.set(null);
    this.eliminandoLista.set(false);
    this.errorEliminacion.set(null);
    this.productoPendienteEliminacion.set(null);
    this.eliminandoProductoId.set(null);
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

  editarLista(lista: ListaDeseos): void {
    if (this.guardandoModificacion()) return;
    this.errorModificacion.set(null);
    this.formularioNombre.controls.nombre.setValue(lista.nombre);
    this.listaPendienteModificacion.set(lista);
  }

  cancelarModificacion(): void {
    if (this.guardandoModificacion()) return;
    this.listaPendienteModificacion.set(null);
    this.errorModificacion.set(null);
  }

  confirmarModificacion(): void {
    const lista = this.listaPendienteModificacion();
    if (!lista || this.guardandoModificacion()) return;

    const nombre = this.formularioNombre.controls.nombre.value.trim();
    if (!nombre) {
      this.errorModificacion.set('Escribe un nombre para la lista.');
      return;
    }

    this.errorModificacion.set(null);
    this.guardandoModificacion.set(true);
    this.listas.update((listas) =>
      listas.map((actual) => (actual.id === lista.id ? { ...actual, nombre } : actual)),
    );
    this.listasService.modificarLista(lista.id, nombre).subscribe({
      next: (listaActualizada) => {
        this.listas.update((listas) =>
          listas.map((actual) => (actual.id === lista.id ? listaActualizada : actual)),
        );
        this.listaPendienteModificacion.set(null);
        this.guardandoModificacion.set(false);
      },
      error: (error: ListaDeseosApiError) => {
        this.listas.update((listas) =>
          listas.map((actual) => (actual.id === lista.id ? lista : actual)),
        );
        this.errorModificacion.set(error.message);
        this.guardandoModificacion.set(false);
      },
    });
  }

  solicitarEliminacionLista(lista: ListaDeseos): void {
    if (this.eliminandoLista()) return;
    this.errorEliminacionLista.set(null);
    this.listaPendienteEliminar.set(lista);
  }

  cancelarEliminacionLista(): void {
    if (this.eliminandoLista()) return;
    this.listaPendienteEliminar.set(null);
    this.errorEliminacionLista.set(null);
  }

  confirmarEliminacionLista(): void {
    const lista = this.listaPendienteEliminar();
    if (!lista || this.eliminandoLista()) return;

    this.errorEliminacionLista.set(null);
    this.eliminandoLista.set(true);
    this.listasService.eliminarLista(lista.id).subscribe({
      next: () => {
        this.listas.update((listas) => listas.filter((actual) => actual.id !== lista.id));
        this.listaPendienteEliminar.set(null);
        this.eliminandoLista.set(false);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorEliminacionLista.set(error.message);
        this.eliminandoLista.set(false);
      },
    });
  }

  solicitarEliminacion(producto: Producto): void {
    if (this.eliminandoProductoId()) return;
    this.errorEliminacion.set(null);
    this.productoPendienteEliminacion.set(producto);
  }

  cancelarEliminacion(): void {
    if (this.eliminandoProductoId()) return;
    this.productoPendienteEliminacion.set(null);
    this.errorEliminacion.set(null);
  }

  confirmarEliminacion(): void {
    const producto = this.productoPendienteEliminacion();
    const idLista = this.idLista();
    if (!idLista || !producto || this.eliminandoProductoId()) {
      return;
    }

    this.errorEliminacion.set(null);
    this.eliminandoProductoId.set(producto.id);
    this.listasService.eliminarProducto(idLista, producto.id).subscribe({
      next: () => {
        this.productos.update((productos) => productos.filter((actual) => actual.id !== producto.id));
        this.listas.update((listas) =>
          listas.map((lista) =>
            lista.id === idLista
              ? { ...lista, productosIds: lista.productosIds.filter((id) => id !== producto.id) }
              : lista,
          ),
        );
        this.productoPendienteEliminacion.set(null);
        this.eliminandoProductoId.set(null);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorEliminacion.set(error.message);
        this.eliminandoProductoId.set(null);
      },
    });
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
