import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  readonly listaEnEdicion = signal<ListaDeseos | null>(null);
  readonly guardandoModificacion = signal(false);
  readonly errorModificacion = signal<string | null>(null);
  readonly formularioNombre = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
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
    this.listaEnEdicion.set(null);
    this.errorModificacion.set(null);
    this.guardandoModificacion.set(false);
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

    this.formularioNombre.controls.nombre.setValue(lista.nombre);
    this.formularioNombre.controls.nombre.markAsPristine();
    this.formularioNombre.controls.nombre.markAsUntouched();
    this.errorModificacion.set(null);
    this.listaEnEdicion.set(lista);
  }

  cancelarModificacion(): void {
    if (this.guardandoModificacion()) return;
    this.listaEnEdicion.set(null);
    this.errorModificacion.set(null);
  }

  confirmarModificacion(nombreIntroducido: string): void {
    const lista = this.listaEnEdicion();
    const controlNombre = this.formularioNombre.controls.nombre;
    controlNombre.setValue(nombreIntroducido);
    const nombre = nombreIntroducido.trim();
    if (!lista || this.guardandoModificacion()) return;
    if (!nombre) {
      controlNombre.markAsTouched();
      return;
    }

    this.errorModificacion.set(null);
    this.guardandoModificacion.set(true);
    this.listas.update((listas) =>
      listas.map((actual) => (actual.id === lista.id ? { ...actual, nombre } : actual)),
    );
    this.listasService.modificarLista(lista.id, nombre).subscribe({
      next: () => {
        this.listas.update((listas) =>
          listas.map((actual) => (actual.id === lista.id ? { ...actual, nombre } : actual)),
        );
        this.listaEnEdicion.set(null);
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
