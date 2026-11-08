import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ProductInfo } from '../../models/producto.model';
import { AuthService } from '../../services/auth.service';
import { CarritoService } from '../../services/carrito.service';
import {
  ListaDeseos,
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { ProductApiError, ProductService } from '../../services/product.service';

@Component({
  selector: 'app-producto-detalle',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './producto-detalle.html',
  styleUrl: './producto-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoDetalle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productoService = inject(ProductService);
  private readonly carritoService = inject(CarritoService);
  private readonly listasDeseosService = inject(ListaDeseosService);
  readonly auth = inject(AuthService);

  readonly producto = signal<ProductInfo | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly productoId = signal<string | null>(null);
  readonly anadiendoAlCarrito = signal(false);
  readonly cantidadEnCarrito = signal<number | null>(null);
  readonly mensajeCarrito = signal<string | null>(null);
  readonly errorCarrito = signal<string | null>(null);
  readonly selectorListaAbierto = signal(false);
  readonly listasDeseos = signal<ListaDeseos[]>([]);
  readonly listaDeseosSeleccionadaId = signal('');
  readonly cargandoListasDeseos = signal(false);
  readonly guardandoEnLista = signal(false);
  readonly mostrandoNuevaLista = signal(false);
  readonly nombreNuevaLista = signal('');
  readonly errorListaDeseos = signal<string | null>(null);
  readonly mensajeListaDeseos = signal<string | null>(null);
  readonly estrellasSeleccionadas = signal(0);
  readonly estrellasEnHover = signal(0);
  readonly textoValoracion = signal('');
  readonly enviandoValoracion = signal(false);
  readonly errorValoracion = signal<string | null>(null);
  readonly mensajeValoracion = signal<string | null>(null);
  private carritoVersion = 0;

  ngOnInit(): void {
    if (this.esCliente()) {
      this.cargarCantidadCarrito();
    }

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        tap((id) => {
          this.productoId.set(id);
          this.producto.set(null);
          this.error.set(id ? null : 'No se ha indicado ningún producto.');
          this.cargando.set(Boolean(id));
        }),
        switchMap((id) =>
          id
            ? this.productoService.obtenerInfo(id).pipe(
                map((producto) => ({ producto, error: null })),
                catchError((error: ProductApiError) =>
                  of({ producto: null, error: error.message }),
                ),
              )
            : of({ producto: null, error: 'No se ha indicado ningún producto.' }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ producto, error }) => {
        this.producto.set(producto);
        this.error.set(error);
        this.cargando.set(false);
      });
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
      precioCent / 100,
    );
  }

  formatearPrecioConDescuento(precioCent: number, descuento: number): string {
    return this.formatearPrecio(Math.round(precioCent * (1 - descuento / 100)));
  }

  esVendedor(): boolean {
    return this.auth.hasRole(['VENDEDOR']);
  }

  esCliente(): boolean {
    return this.auth.hasRole(['CLIENTE']);
  }

  seleccionarEstrellas(estrellas: number): void {
    this.estrellasSeleccionadas.set(estrellas);
  }

  mostrarEstrellasEnHover(estrellas: number): void {
    this.estrellasEnHover.set(estrellas);
  }

  limpiarEstrellasEnHover(): void {
    this.estrellasEnHover.set(0);
  }

  estrellasActivas(): number {
    return this.estrellasEnHover() || this.estrellasSeleccionadas();
  }

  actualizarTextoValoracion(event: Event): void {
    this.textoValoracion.set((event.target as HTMLTextAreaElement).value);
  }

  enviarValoracion(): void {
    const id = this.productoId();
    const estrellas = this.estrellasSeleccionadas();
    const texto = this.textoValoracion().trim();
    if (!id || !estrellas || !texto || this.enviandoValoracion()) return;

    this.enviandoValoracion.set(true);
    this.errorValoracion.set(null);
    this.mensajeValoracion.set(null);
    this.productoService.crearValoracion(id, estrellas, texto).subscribe({
      next: () => {
        this.mensajeValoracion.set('Tu valoración se ha publicado correctamente.');
        this.estrellasSeleccionadas.set(0);
        this.textoValoracion.set('');
        this.enviandoValoracion.set(false);
        this.productoService.obtenerInfo(id).subscribe({
          next: (producto) => this.producto.set(producto),
          error: () => this.mensajeValoracion.set('La valoración se publicó, pero no se pudo actualizar el resumen.'),
        });
      },
      error: (error: HttpErrorResponse) => {
        this.errorValoracion.set(error.status === 409
          ? 'Ya has valorado este producto.'
          : error.error?.message ?? 'No se ha podido publicar la valoración.');
        this.enviandoValoracion.set(false);
      },
    });
  }

  estrellasDe(media: number): string {
    return '★'.repeat(Math.round(media)) + '☆'.repeat(5 - Math.round(media));
  }

  anadirAlCarrito(): void {
    const id = this.productoId();
    const item = this.producto();
    if (!id || !item || this.anadiendoAlCarrito() || item.numStock < 1) return;

    this.anadiendoAlCarrito.set(true);
    this.mensajeCarrito.set(null);
    this.errorCarrito.set(null);
    this.carritoService.anadirProducto(id).subscribe({
      next: () => {
        this.carritoVersion += 1;
        const cantidadActual = this.cantidadEnCarrito();
        if (cantidadActual === null) {
          this.cargarCantidadCarrito();
        } else {
          this.cantidadEnCarrito.set(cantidadActual + 1);
        }
        this.mensajeCarrito.set(`${item.nombre} se ha añadido a tu cesta.`);
        this.anadiendoAlCarrito.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorCarrito.set(this.mensajeParaErrorCarrito(error));
        this.anadiendoAlCarrito.set(false);
      },
    });
  }

  abrirSelectorLista(): void {
    this.selectorListaAbierto.set(true);
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

  cancelarSelectorLista(): void {
    if (this.guardandoEnLista()) return;
    this.selectorListaAbierto.set(false);
    this.errorListaDeseos.set(null);
  }

  confirmarAnadirALista(): void {
    const idLista = this.listaDeseosSeleccionadaId();
    if (!idLista || this.guardandoEnLista()) return;
    this.guardarEnLista(idLista);
  }

  crearListaYGuardarProducto(): void {
    const nombre = this.nombreNuevaLista().trim();
    if (!nombre || this.guardandoEnLista()) return;

    this.guardandoEnLista.set(true);
    this.errorListaDeseos.set(null);
    this.listasDeseosService.crear(nombre).subscribe({
      next: (lista) => {
        this.listasDeseos.update((listas) => [...listas, lista]);
        this.listaDeseosSeleccionadaId.set(lista.id);
        this.mostrandoNuevaLista.set(false);
        this.nombreNuevaLista.set('');
        this.guardarEnLista(lista.id);
      },
      error: (error: ListaDeseosApiError) => {
        this.errorListaDeseos.set(error.message);
        this.guardandoEnLista.set(false);
      },
    });
  }

  private guardarEnLista(idLista: string): void {
    const idProducto = this.productoId();
    const item = this.producto();
    if (!idProducto || !item) {
      this.guardandoEnLista.set(false);
      return;
    }

    const yaEstabaEnLista = this.listasDeseos()
      .find((lista) => lista.id === idLista)
      ?.productosIds.includes(idProducto) ?? false;

    this.guardandoEnLista.set(true);
    this.errorListaDeseos.set(null);
    this.listasDeseosService.agregarProducto(idLista, idProducto).subscribe({
      next: (listaActualizada) => {
        this.listasDeseos.update((listas) =>
          listas.map((lista) => lista.id === listaActualizada.id ? listaActualizada : lista),
        );
        this.mensajeListaDeseos.set(
          yaEstabaEnLista
            ? `${item.nombre} ya está añadido a la lista de deseos «${listaActualizada.nombre}».`
            : `${item.nombre} se ha guardado correctamente en la lista «${listaActualizada.nombre}».`,
        );
        this.selectorListaAbierto.set(false);
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
      next: (items) => {
        if (version === this.carritoVersion) {
          this.cantidadEnCarrito.set(items.reduce((total, item) => total + item.cantidad, 0));
        }
      },
      error: (error: HttpErrorResponse) => {
        if (version === this.carritoVersion) {
          this.errorCarrito.set(this.mensajeParaErrorConsultaCarrito(error));
        }
      },
    });
  }

  private mensajeParaErrorConsultaCarrito(error: HttpErrorResponse): string {
    if (error.status === 0) return 'No se puede conectar con el servidor para consultar tu cesta.';
    if (error.status === 401) return 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar la cesta.';
    if (error.status === 403) return 'Solo los clientes pueden consultar su cesta.';
    return `No se ha podido consultar el contenido de la cesta (HTTP ${error.status}).`;
  }

  private mensajeParaErrorCarrito(error: HttpErrorResponse): string {
    if (error.status === 0) return 'No se puede conectar con el servidor para añadir el producto.';
    if (error.status === 401) return 'Inicia sesión como cliente para añadir productos a la cesta.';
    if (error.status === 403) return 'Solo los clientes pueden añadir productos a la cesta.';
    if (error.status === 404) return 'El producto ya no está disponible.';
    return `No se ha podido añadir el producto a la cesta (HTTP ${error.status}).`;
  }
}