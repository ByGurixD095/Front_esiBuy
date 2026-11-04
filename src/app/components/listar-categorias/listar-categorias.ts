import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Categoria, Categorias } from '../../services/categorias.service';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

/** HU 31: listado de categorías del catálogo. HU 30: eliminación con confirmación. */
@Component({
  selector: 'app-listar-categorias',
  imports: [RouterLink, MarcoPagina],
  templateUrl: './listar-categorias.html',
  styleUrl: './listar-categorias.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListarCategorias implements OnInit {
  private readonly categoriasPorPagina = 8;
  private readonly categoriasService = inject(Categorias);

  readonly categorias = signal<Categoria[]>([]);
  readonly busqueda = signal('');
  readonly paginaActual = signal(0);
  readonly categoriasFiltradas = computed(() => {
    const consulta = this.busqueda().trim().toLocaleLowerCase();
    if (!consulta) return this.categorias();
    return this.categorias().filter((categoria) =>
      categoria.nombre.toLocaleLowerCase().includes(consulta),
    );
  });
  readonly categoriasPagina = computed(() => {
    const inicio = this.paginaActual() * this.categoriasPorPagina;
    return this.categoriasFiltradas().slice(inicio, inicio + this.categoriasPorPagina);
  });
  readonly totalPaginas = computed(() =>
    Math.ceil(this.categoriasFiltradas().length / this.categoriasPorPagina),
  );
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly categoriaPendiente = signal<Categoria | null>(null);
  readonly eliminando = signal(false);
  readonly categoriaEditando = signal<Categoria | null>(null);
  readonly nombreEditado = signal('');
  readonly guardandoEdicion = signal(false);
  readonly mensajeExito = signal('');
  readonly errorEliminar = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.categoriasService.listar().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.ajustarPagina();
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.textoDeError(error));
        this.cargando.set(false);
      },
    });
  }

  actualizarBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
    this.paginaActual.set(0);
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 0) this.paginaActual.update((pagina) => pagina - 1);
  }

  paginaSiguiente(): void {
    if (this.paginaActual() + 1 < this.totalPaginas()) {
      this.paginaActual.update((pagina) => pagina + 1);
    }
  }

  pedirEliminar(categoria: Categoria): void {
    if (this.eliminando() || this.guardandoEdicion()) {
      return;
    }
    this.mensajeExito.set('');
    this.errorEliminar.set('');
    this.categoriaPendiente.set(categoria);
  }

  empezarEdicion(categoria: Categoria): void {
    if (this.eliminando() || this.guardandoEdicion()) return;
    this.errorEliminar.set('');
    this.mensajeExito.set('');
    this.categoriaEditando.set(categoria);
    this.nombreEditado.set(categoria.nombre);
  }

  actualizarNombre(event: Event): void {
    this.nombreEditado.set((event.target as HTMLInputElement).value);
  }

  cancelarEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.categoriaEditando.set(null);
  }

  guardarEdicion(): void {
    const categoria = this.categoriaEditando();
    const nombre = this.nombreEditado().trim();
    if (!categoria || !nombre || this.guardandoEdicion()) return;

    this.guardandoEdicion.set(true);
    this.errorEliminar.set('');
    this.categoriasService.actualizar(categoria.id, { nombre }).subscribe({
      next: (actualizada) => {
        this.categorias.update((lista) =>
          lista
            .map((item) => item.id === actualizada.id ? actualizada : item)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' })),
        );
        this.ajustarPagina();
        this.mensajeExito.set(`La categoría se ha cambiado a «${actualizada.nombre}».`);
        this.categoriaEditando.set(null);
        this.guardandoEdicion.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorEliminar.set(this.textoDeErrorEdicion(error));
        this.guardandoEdicion.set(false);
      },
    });
  }

  cancelarEliminar(): void {
    if (this.eliminando()) {
      return;
    }
    this.categoriaPendiente.set(null);
    this.errorEliminar.set('');
  }

  confirmarEliminar(): void {
    const categoria = this.categoriaPendiente();
    if (!categoria || this.eliminando()) {
      return;
    }

    this.eliminando.set(true);
    this.categoriasService.eliminar(categoria.id).subscribe({
      next: () => {
        this.quitarDeLaLista(categoria.id);
        this.mensajeExito.set(`La categoría «${categoria.nombre}» se ha eliminado.`);
        this.cerrarDialogo();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.quitarDeLaLista(categoria.id);
        }
        this.errorEliminar.set(this.textoDeErrorEliminar(error));
        if (error.status === 409) {
          this.eliminando.set(false);
          return;
        }
        this.cerrarDialogo();
      },
    });
  }

  private quitarDeLaLista(id: string): void {
    this.categorias.update((lista) => lista.filter((c) => c.id !== id));
    this.ajustarPagina();
  }

  private ajustarPagina(): void {
    this.paginaActual.set(Math.min(this.paginaActual(), Math.max(0, this.totalPaginas() - 1)));
  }

  private cerrarDialogo(): void {
    this.eliminando.set(false);
    this.categoriaPendiente.set(null);
  }

  private textoDeErrorEliminar(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return (
        error.error?.message ??
        'No se puede eliminar la categoría porque hay productos que la usan.'
      );
    }

    if (error.status === 404) {
      return 'La categoría ya no existe.';
    }
    if (error.status === 401 || error.status === 403) {
      return 'No tienes permisos para eliminar categorías. Inicia sesión como administrador.';
    }
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    return 'No se ha podido eliminar la categoría. Inténtalo de nuevo.';
  }

  private textoDeErrorEdicion(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return error.error?.message ?? 'Ya existe una categoría con ese nombre.';
    }
    if (error.status === 404) return 'La categoría ya no existe.';
    if (error.status === 401 || error.status === 403) {
      return 'No tienes permisos para modificar categorías. Inicia sesión como administrador.';
    }
    if (error.status === 0) return 'No se ha podido conectar con el servidor.';
    return 'No se ha podido modificar la categoría. Inténtalo de nuevo.';
  }

  private textoDeError(error: HttpErrorResponse): string {
    if (error.status === 401 || error.status === 403) {
      return 'No se han podido cargar las categorías. Inténtalo de nuevo.';
    }
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    return 'No se han podido cargar las categorías. Inténtalo de nuevo.';
  }
}
