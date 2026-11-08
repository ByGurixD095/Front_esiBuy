import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PaginaProducto, Producto } from '../../models/producto.model';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { Favoritos, FavoritosApiError } from '../../services/favoritos-service/favoritos';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';
import { Categoria, Categorias } from '../../services/categorias.service';
import {
  ListaDeseos,
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { PanelFiltrosProductos } from '../panel-filtros-productos/panel-filtros-productos';
import { FiltrosProductos, ProductApiError, ProductService, filtrarProductos } from '../../services/product.service';

@Component({
  selector: 'app-catalogo',
  imports: [RouterLink, PanelFiltrosProductos, MarcoPagina],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalogo implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly favoritosService = inject(Favoritos);
  private readonly carritoService = inject(CarritoService);
  private readonly categoriasService = inject(Categorias);
  private readonly listasDeseosService = inject(ListaDeseosService);
  readonly auth = inject(AuthService);

  readonly productos = signal<Producto[]>([]);
  readonly categoriasDisponibles = signal<Categoria[]>([]);
  readonly errorCategorias = signal<string | null>(null);
  readonly totalCatalogo = signal<number | null>(null);
  readonly totalElementos = signal(0);
  readonly totalPaginas = signal(0);
  readonly paginaActual = signal(0);
  readonly tamanoPagina = 36;
  readonly cargando = signal(true);
  readonly error = signal<{ status: number; message: string } | null>(null);
  private readonly filtros = signal<FiltrosProductos>({});

  // HU 15: favoritos del cliente (solo se usan si el rol es CLIENTE)
  readonly favoritosIds = signal<ReadonlySet<string>>(new Set());
  readonly favoritosProcesando = signal<ReadonlySet<string>>(new Set());
  readonly errorFavorito = signal<string | null>(null);
  readonly carritoProcesando = signal<ReadonlySet<string>>(new Set());
  readonly mensajeCarrito = signal<string | null>(null);
  readonly errorCarrito = signal<string | null>(null);
  readonly cantidadCarrito = signal<number | null>(null);
  private carritoVersion = 0;
  readonly productoListaPendiente = signal<Producto | null>(null);
  readonly listasDeseos = signal<ListaDeseos[]>([]);
  readonly listaDeseosSeleccionadaId = signal('');
  readonly cargandoListasDeseos = signal(false);
  readonly guardandoEnLista = signal(false);
  readonly mostrandoNuevaLista = signal(false);
  readonly nombreNuevaLista = signal('');
  readonly errorListaDeseos = signal<string | null>(null);
  readonly mensajeListaDeseos = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarCatalogo();
    if (this.esCliente()) {
      this.cargarFavoritos();
      this.cargarCantidadCarrito();
    }
  }

  cargarCategorias(): void {
    this.errorCategorias.set(null);
    this.categoriasService.listar().subscribe({
      next: (categorias) => this.categoriasDisponibles.set(categorias),
      error: (error: HttpErrorResponse) => {
        this.errorCategorias.set(
          error.status === 0
            ? 'No se ha podido conectar con el servidor para cargar las categorías.'
            : `No se han podido cargar las categorías (HTTP ${error.status}).`,
        );
      },
    });
  }

  esCliente(): boolean {
    return this.auth.hasRole(['CLIENTE']);
  }

  esFavorito(productoId: string): boolean {
    return this.favoritosIds().has(productoId);
  }

  favoritoProcesando(productoId: string): boolean {
    return this.favoritosProcesando().has(productoId);
  }

  private cargarFavoritos(): void {
    this.favoritosService.listar().subscribe({
      next: (productos) => this.favoritosIds.set(new Set(productos.map((p) => p.id))),
      error: (error: FavoritosApiError) => this.errorFavorito.set(error.message),
    });
  }

  alternarFavorito(producto: Producto): void {
    if (this.favoritoProcesando(producto.id)) return;

    const eraFavorito = this.esFavorito(producto.id);
    this.errorFavorito.set(null);
    this.favoritosProcesando.update((ids) => new Set(ids).add(producto.id));

    const peticion = eraFavorito
      ? this.favoritosService.quitar(producto.id)
      : this.favoritosService.marcar(producto.id);

    peticion.subscribe({
      next: () => {
        this.favoritosIds.update((ids) => {
          const siguiente = new Set(ids);
          if (eraFavorito) siguiente.delete(producto.id);
          else siguiente.add(producto.id);
          return siguiente;
        });
        this.terminarProceso(producto.id);
      },
      error: (error: FavoritosApiError) => {
        this.errorFavorito.set(error.message);
        this.terminarProceso(producto.id);
      },
    });
  }

  anadirAlCarrito(producto: Producto): void {
    if (this.carritoProcesando().has(producto.id)) return;

    this.mensajeCarrito.set(null);
    this.errorCarrito.set(null);
    this.carritoProcesando.update((ids) => new Set(ids).add(producto.id));
    this.carritoService.anadirProducto(producto.id).subscribe({
      next: () => {
        this.carritoVersion += 1;
        const cantidadActual = this.cantidadCarrito();
        if (cantidadActual === null) {
          this.cargarCantidadCarrito();
        } else {
          this.cantidadCarrito.set(cantidadActual + 1);
        }
        this.mensajeCarrito.set(`${producto.nombre} se ha añadido a tu cesta.`);
        this.terminarAnadirAlCarrito(producto.id);
      },
      error: (error: HttpErrorResponse) => {
        this.errorCarrito.set(this.mensajeParaErrorCarrito(error.status));
        this.terminarAnadirAlCarrito(producto.id);
      },
    });
  }

  estaAnadiendoAlCarrito(productoId: string): boolean {
    return this.carritoProcesando().has(productoId);
  }

  abrirSelectorLista(producto: Producto): void {
    this.productoListaPendiente.set(producto);
    this.listasDeseos.set([]);
    this.listaDeseosSeleccionadaId.set('');
    this.mostrandoNuevaLista.set(false);
    this.nombreNuevaLista.set('');
    this.errorListaDeseos.set(null);
    this.mensajeListaDeseos.set(null);
    this.cargarListasDeseos();
  }

  cargarListasDeseos(): void {
    this.cargandoListasDeseos.set(true);
    this.errorListaDeseos.set(null);
    this.listasDeseosService.listar().subscribe({
      next: (listas) => {
        this.listasDeseos.set(listas);
        this.listaDeseosSeleccionadaId.set(listas[0]?.id ?? '');
        this.cargandoListasDeseos.set(false);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorListaDeseos.set(error.message);
        this.cargandoListasDeseos.set(false);
      },
    });
  }

  seleccionarListaDeseos(event: Event): void {
    this.listaDeseosSeleccionadaId.set((event.target as HTMLSelectElement).value);
  }

  alternarFormularioNuevaLista(): void {
    this.mostrandoNuevaLista.update((mostrar) => !mostrar);
    this.nombreNuevaLista.set('');
    this.errorListaDeseos.set(null);
  }

  actualizarNombreNuevaLista(event: Event): void {
    this.nombreNuevaLista.set((event.target as HTMLInputElement).value);
  }

  crearListaYGuardarProducto(): void {
    const producto = this.productoListaPendiente();
    const nombre = this.nombreNuevaLista().trim();
    if (!producto || !nombre || this.guardandoEnLista()) return;

    this.guardandoEnLista.set(true);
    this.errorListaDeseos.set(null);
    this.listasDeseosService.crear(nombre).subscribe({
      next: (lista) => {
        this.listasDeseos.update((listas) => [...listas, lista]);
        this.listaDeseosSeleccionadaId.set(lista.id);
        this.mostrandoNuevaLista.set(false);
        this.nombreNuevaLista.set('');
        this.guardarProductoEnLista(producto, lista.id);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorListaDeseos.set(error.message);
        this.guardandoEnLista.set(false);
      },
    });
  }

  cancelarSeleccionLista(): void {
    if (this.guardandoEnLista()) return;
    this.productoListaPendiente.set(null);
    this.errorListaDeseos.set(null);
  }

  confirmarAnadirALista(): void {
    const producto = this.productoListaPendiente();
    const idLista = this.listaDeseosSeleccionadaId();
    if (!producto || !idLista || this.guardandoEnLista()) return;

    this.guardandoEnLista.set(true);
    this.errorListaDeseos.set(null);
    this.guardarProductoEnLista(producto, idLista);
  }

  private guardarProductoEnLista(producto: Producto, idLista: string): void {
    const yaEstabaEnLista = this.listasDeseos()
      .find((lista) => lista.id === idLista)
      ?.productosIds.includes(producto.id) ?? false;

    this.listasDeseosService.agregarProducto(idLista, producto.id).subscribe({
      next: (listaActualizada) => {
        this.listasDeseos.update((listas) =>
          listas.map((lista) => lista.id === listaActualizada.id ? listaActualizada : lista),
        );
        this.mensajeListaDeseos.set(
          yaEstabaEnLista
            ? `${producto.nombre} ya está añadido a la lista de deseos «${listaActualizada.nombre}».`
            : `${producto.nombre} se ha guardado correctamente en la lista «${listaActualizada.nombre}».`,
        );
        this.productoListaPendiente.set(null);
        this.guardandoEnLista.set(false);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorListaDeseos.set(error.message);
        this.guardandoEnLista.set(false);
      },
    });
  }

  private cargarCantidadCarrito(): void {
    const version = ++this.carritoVersion;
    this.carritoService.obtenerCarrito().subscribe({
      next: (items: ItemCarrito[]) => {
        if (version === this.carritoVersion) {
          this.cantidadCarrito.set(items.reduce((total, item) => total + item.cantidad, 0));
        }
      },
      error: (error: HttpErrorResponse) => {
        if (version === this.carritoVersion) {
          this.errorCarrito.set(
            error.status === 0
              ? 'No se ha podido consultar el contenido de tu cesta.'
              : `No se ha podido consultar la cesta (HTTP ${error.status}).`,
          );
        }
      },
    });
  }

  private terminarProceso(productoId: string): void {
    this.favoritosProcesando.update((ids) => {
      const siguiente = new Set(ids);
      siguiente.delete(productoId);
      return siguiente;
    });
  }

  private terminarAnadirAlCarrito(productoId: string): void {
    this.carritoProcesando.update((ids) => {
      const siguientes = new Set(ids);
      siguientes.delete(productoId);
      return siguientes;
    });
  }

  private mensajeParaErrorCarrito(status: number): string {
    if (status === 0) return 'No se puede conectar con el servidor para añadir el producto.';
    if (status === 401) return 'Inicia sesión como cliente para añadir productos a la cesta.';
    if (status === 403) return 'El servidor ha rechazado la petición (403). Comprueba tus permisos y el token de seguridad.';
    if (status === 404) return 'El producto ya no está disponible.';
    return `No se ha podido añadir el producto a la cesta (HTTP ${status}).`;
  }

  cargarCatalogo(filtros: FiltrosProductos = this.filtros()): void {
    this.cargando.set(true);
    this.error.set(null);
    this.productService.obtenerDisponibles(filtros, this.paginaActual(), this.tamanoPagina).subscribe({
      next: (paginaProductos: PaginaProducto) => {
        this.productos.set(filtrarProductos(paginaProductos.content, filtros));
        this.totalPaginas.set(paginaProductos.totalPages);
        this.totalElementos.set(paginaProductos.totalElements);
        if (paginaProductos.number === 0 && !this.hayFiltrosRestrictivos(filtros)) {
          this.totalCatalogo.set(paginaProductos.totalElements);
        }
        this.paginaActual.set(paginaProductos.number);
        this.cargando.set(false);
      },
      error: (error: ProductApiError) => {
        this.error.set({ status: error.status, message: error.message });
        this.cargando.set(false);
      },
    });
  }

  private hayFiltrosRestrictivos(filtros: FiltrosProductos): boolean {
    return Boolean(
      filtros.busqueda?.trim() ||
        (filtros.categoriaId && filtros.categoriaId !== 'Todas' && filtros.categoriaId !== 'TODAS') ||
        filtros.precioMinCent != null ||
        filtros.precioMaxCent != null ||
        filtros.soloOfertas ||
        (filtros.estado && filtros.estado !== 'todos'),
    );
  }

  aplicarFiltros(filtros: FiltrosProductos): void {
    this.filtros.set(filtros);
    this.paginaActual.set(0);
    this.cargarCatalogo();
  }

  paginaAnterior(): void {
    if (this.paginaActual() === 0) return;
    this.paginaActual.update((pagina) => pagina - 1);
    this.cargarCatalogo();
  }

  paginaSiguiente(): void {
    if (this.paginaActual() + 1 >= this.totalPaginas()) return;
    this.paginaActual.update((pagina) => pagina + 1);
    this.cargarCatalogo();
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(precioCent / 100);
  }

  formatearPrecioConDescuento(precioCent: number, descuento: number): string {
    return this.formatearPrecio(Math.round(precioCent * (1 - descuento / 100)));
  }
}
