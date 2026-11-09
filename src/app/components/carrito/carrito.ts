import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';
import { DireccionGuardada, DireccionesService } from '../../services/direcciones.service';
import { MetodoPago, MetodosPagoService } from '../../services/metodos-pago-service/metodos-pago';
import { CrearPedidoRequest, PedidoCreado, PedidosService } from '../../services/pedidos.service';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-carrito',
  imports: [MarcoPagina, ReactiveFormsModule, RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Carrito implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly carritoService = inject(CarritoService);
  private readonly direccionesService = inject(DireccionesService);
  private readonly metodosPagoService = inject(MetodosPagoService);
  private readonly pedidosService = inject(PedidosService);
  private metodoPagoPreferido: string | null = null;
  private direccionPreferida: string | null = null;

  // Inyectamos ProductService para poder consultar el vendedor de cada item
  private readonly productoService = inject(ProductService);

  readonly items = signal<(ItemCarrito & { vendedor: string })[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly actualizandoIds = signal<ReadonlySet<string>>(new Set());
  readonly productoPendienteEliminar = signal<ItemCarrito | null>(null);
  readonly confirmacionVaciar = signal(false);
  readonly vaciandoCarrito = signal(false);
  readonly checkoutAbierto = signal(false);
  readonly metodosPago = signal<MetodoPago[]>([]);
  readonly cargandoMetodosPago = signal(false);
  readonly errorMetodosPago = signal('');
  readonly direcciones = signal<DireccionGuardada[]>([]);
  readonly cargandoDirecciones = signal(false);
  readonly errorDirecciones = signal('');
  readonly creandoPedido = signal(false);
  readonly procesandoPago = signal(false);
  readonly errorPedido = signal('');
  readonly errorPago = signal('');
  
  // Cambiamos a un array para soportar múltiples pedidos a la vez
  readonly pedidosPendientesPago = signal<PedidoCreado[]>([]);
  readonly pedidoConfirmado = signal<boolean>(false);

  readonly cantidadUnidades = computed(() => this.items().reduce((total, item) => total + item.cantidad, 0));
  readonly totalCentimos = computed(() =>
    this.items().reduce((total, item) => total + item.precioCent * item.cantidad, 0),
  );

  // AGRUPACIÓN POR LOTE
  readonly lotesPorVendedor = computed(() => {
    const map = new Map<string, { vendedor: string; items: (ItemCarrito & { vendedor: string })[]; subtotal: number }>();
    for (const item of this.items()) {
      if (!map.has(item.vendedor)) {
        map.set(item.vendedor, { vendedor: item.vendedor, items: [], subtotal: 0 });
      }
      const lote = map.get(item.vendedor)!;
      lote.items.push(item);
      lote.subtotal += item.precioCent * item.cantidad;
    }
    return Array.from(map.values());
  });

  readonly vendedoresSeleccionados = signal<Set<string>>(new Set());

  readonly totalCheckout = computed(() => {
    const seleccionados = this.vendedoresSeleccionados();
    return this.lotesPorVendedor()
      .filter(l => seleccionados.has(l.vendedor))
      .reduce((total, l) => total + l.subtotal, 0);
  });

  readonly totalPendientePago = computed(() => 
    this.pedidosPendientesPago().reduce((sum, p) => sum + p.totalCent, 0)
  );

  readonly checkoutForm = new FormGroup({
    metodoPagoId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direccionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.cargarCarrito();
  }

  cargarCarrito(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.carritoService.obtenerCarrito().pipe(
      switchMap(items => {
        if (items.length === 0) return of([]);
        // Consultamos la información de cada producto para averiguar su vendedor
        const peticiones = items.map(item =>
          this.productoService.obtenerInfo(item.productoId).pipe(
            map(info => ({ ...item, vendedor: info.vendedor })),
            catchError(() => of({ ...item, vendedor: 'Vendedor Desconocido' }))
          )
        );
        return forkJoin(peticiones);
      })
    ).subscribe({
      next: (itemsConVendedor) => {
        this.items.set(itemsConVendedor);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.mensajeParaError(error));
        this.cargando.set(false);
      },
    });
  }

  editarCantidad(event: Event, item: ItemCarrito): void {
    const entrada = event.target;
    if (!(entrada instanceof HTMLInputElement)) return;

    const cantidad = entrada.valueAsNumber;
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      this.error.set('La cantidad debe ser un número entero mayor que cero.');
      entrada.value = String(item.cantidad);
      return;
    }
    this.actualizarCantidad(item, cantidad);
  }

  actualizarCantidad(item: ItemCarrito, cantidad: number): void {
    if (cantidad < 1 || cantidad === item.cantidad || this.actualizandoIds().has(item.productoId)) return;

    this.error.set(null);
    this.actualizandoIds.update((ids) => new Set(ids).add(item.productoId));
    this.carritoService.actualizarCantidad(item.productoId, cantidad).subscribe({
      next: () => {
        this.items.update((items) =>
          items.map((actual) =>
            actual.productoId === item.productoId ? { ...actual, cantidad } : actual,
          ),
        );
        this.limpiarActualizando(item.productoId);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.mensajeParaError(error));
        this.limpiarActualizando(item.productoId);
      },
    });
  }

  eliminarProducto(item: ItemCarrito): void {
    if (this.actualizandoIds().has(item.productoId)) return;
    this.productoPendienteEliminar.set(item);
  }

  cancelarEliminacion(): void {
    this.productoPendienteEliminar.set(null);
  }

  solicitarVaciado(): void {
    if (!this.vaciandoCarrito() && this.actualizandoIds().size === 0) {
      this.confirmacionVaciar.set(true);
    }
  }

  cancelarVaciado(): void {
    this.confirmacionVaciar.set(false);
  }

  confirmarVaciado(): void {
    if (this.vaciandoCarrito() || this.actualizandoIds().size > 0) return;

    this.confirmacionVaciar.set(false);
    this.vaciandoCarrito.set(true);
    this.error.set(null);
    this.carritoService.vaciar().subscribe({
      next: () => {
        this.items.set([]);
        this.vaciandoCarrito.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.auth.errorMessage(error, 'No se ha podido vaciar la cesta.'));
        this.vaciandoCarrito.set(false);
      },
    });
  }

  confirmarEliminacion(): void {
    const item = this.productoPendienteEliminar();
    if (!item || this.actualizandoIds().has(item.productoId)) return;

    this.productoPendienteEliminar.set(null);
    this.error.set(null);
    this.actualizandoIds.update((ids) => new Set(ids).add(item.productoId));
    this.carritoService.eliminarProducto(item.productoId).subscribe({
      next: () => {
        this.items.update((items) => items.filter((actual) => actual.productoId !== item.productoId));
        this.limpiarActualizando(item.productoId);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.mensajeParaError(error));
        this.limpiarActualizando(item.productoId);
      },
    });
  }

  abrirCheckout(): void {
    this.checkoutAbierto.set(true);
    this.errorPedido.set('');
    this.errorPago.set('');
    this.cargarMetodosPago();
    this.cargarDirecciones();
    
    // Marcar todos los lotes por defecto
    this.vendedoresSeleccionados.set(new Set(this.lotesPorVendedor().map(l => l.vendedor)));

    setTimeout(() => {
      const seccionCheckout = document.getElementById('zona-confirmacion');
      if (seccionCheckout) {
        seccionCheckout.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }

  cerrarCheckout(): void {
    if (!this.creandoPedido()) {
      this.checkoutAbierto.set(false);
      this.errorPedido.set('');
    }
  }

  alternarVendedor(vendedorId: string): void {
    const seleccionados = new Set(this.vendedoresSeleccionados());
    if (seleccionados.has(vendedorId)) {
      seleccionados.delete(vendedorId);
    } else {
      seleccionados.add(vendedorId);
    }
    this.vendedoresSeleccionados.set(seleccionados);
  }

  cargarMetodosPago(): void {
    this.cargandoMetodosPago.set(true);
    this.errorMetodosPago.set('');
    this.metodosPagoService.listar().subscribe({
      next: (metodos) => {
        this.metodosPago.set(metodos);
        if (
          metodos.length > 0 &&
          !metodos.some((metodo) => metodo.id === this.checkoutForm.controls.metodoPagoId.value)
        ) {
          this.checkoutForm.controls.metodoPagoId.setValue(metodos[0].id);
        }
        this.cargandoMetodosPago.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMetodosPago.set(
          this.auth.errorMessage(error, 'No se han podido cargar tus métodos de pago.'),
        );
        this.cargandoMetodosPago.set(false);
      },
    });
  }

  cargarDirecciones(): void {
    this.cargandoDirecciones.set(true);
    this.errorDirecciones.set('');
    this.direccionesService.listar().subscribe({
      next: (direcciones) => {
        this.direcciones.set(direcciones);
        const direccionId = this.checkoutForm.controls.direccionId.value;
        if (!direcciones.some((direccion) => direccion.id === direccionId)) {
          this.checkoutForm.controls.direccionId.setValue(direcciones[0]?.id ?? '');
        }
        this.cargandoDirecciones.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorDirecciones.set(
          this.auth.errorMessage(error, 'No se han podido cargar tus direcciones de envío.'),
        );
        this.cargandoDirecciones.set(false);
      },
    });
  }

  async confirmarPedido(): Promise<void> {
    if (this.creandoPedido()) return;
    if (this.checkoutForm.invalid || this.metodosPago().length === 0 || this.direcciones().length === 0) {
      this.checkoutForm.markAllAsTouched();
      this.errorPedido.set('Selecciona una dirección guardada y un método de pago.');
      return;
    }
    
    const seleccionados = Array.from(this.vendedoresSeleccionados());
    if (seleccionados.length === 0) {
      this.errorPedido.set('Selecciona al menos un lote de productos para tramitar.');
      return;
    }

    const valores = this.checkoutForm.getRawValue();
    const direccion = this.direcciones().find((item) => item.id === valores.direccionId);
    if (!direccion) {
      this.errorPedido.set('La dirección seleccionada ya no está disponible. Actualiza la lista.');
      return;
    }

    const datosFormato = {
      metodoPagoId: valores.metodoPagoId,
      direccionEnvio: {
        nombreCompleto: direccion.nombreCompleto,
        direccion: direccion.direccion,
        ciudad: direccion.ciudad,
        provincia: direccion.provincia,
        codigoPostal: direccion.codigoPostal,
        pais: direccion.pais,
        telefono: direccion.telefono,
      },
    };

    this.creandoPedido.set(true);
    this.errorPedido.set('');
    
    const lotesAComprar = this.lotesPorVendedor().filter(l => seleccionados.includes(l.vendedor));
    const lotesNoComprados = this.lotesPorVendedor().filter(l => !seleccionados.includes(l.vendedor));

    try {
      const pedidosGenerados = await this.crearPedidosPorLote(lotesAComprar, datosFormato);
      await this.restaurarLotesNoComprados(lotesNoComprados);
      this.pedidosPendientesPago.set(pedidosGenerados);
      this.creandoPedido.set(false);
      this.cargarCarrito();

    } catch (error: any) {
      this.errorPedido.set('Error procesando los lotes. Es posible que algún producto se haya agotado en este instante.');
      this.creandoPedido.set(false);
      this.cargarCarrito();
    }
  }

  private async crearPedidosPorLote(
    lotes: { items: (ItemCarrito & { vendedor: string })[] }[],
    datosFormato: CrearPedidoRequest,
  ): Promise<PedidoCreado[]> {
    const pedidosGenerados: PedidoCreado[] = [];
    for (const lote of lotes) {
      await firstValueFrom(this.carritoService.vaciar());
      await this.anadirItemsAlCarrito(lote.items);
      pedidosGenerados.push(await firstValueFrom(this.pedidosService.crear(datosFormato)));
    }
    return pedidosGenerados;
  }

  private async restaurarLotesNoComprados(
    lotes: { items: (ItemCarrito & { vendedor: string })[] }[],
  ): Promise<void> {
    await firstValueFrom(this.carritoService.vaciar());
    for (const lote of lotes) {
      await this.anadirItemsAlCarrito(lote.items);
    }
  }

  private async anadirItemsAlCarrito(items: (ItemCarrito & { vendedor: string })[]): Promise<void> {
    for (const item of items) {
      await firstValueFrom(this.carritoService.anadirProducto(item.productoId));
      if (item.cantidad > 1) {
        await firstValueFrom(this.carritoService.actualizarCantidad(item.productoId, item.cantidad));
      }
    }
  }

  confirmarPago(): void {
    const pedidos = this.pedidosPendientesPago();
    if (pedidos.length === 0 || this.procesandoPago()) return;

    this.procesandoPago.set(true);
    this.errorPago.set('');

    const peticiones = pedidos.map(p => this.pedidosService.pagar(p.id));
    
    forkJoin(peticiones).subscribe({
      next: () => {
        this.pedidoConfirmado.set(true);
        this.pedidosPendientesPago.set([]);
        this.procesandoPago.set(false);
        this.checkoutAbierto.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.procesandoPago.set(false);
        if (error.status === 409) {
          this.pedidosPendientesPago.set([]);
          this.errorPago.set(
            'No se pudo completar el pago dentro del plazo. Hemos actualizado el carrito; revísalo antes de realizar otro pedido.',
          );
          this.cargarCarrito();
        } else {
          this.errorPago.set(
            this.auth.errorMessage(error, 'No se ha podido confirmar el pago de todos los lotes. Revisa la página de pedidos.'),
          );
        }
      },
    });
  }

  estaActualizando(productoId: string): boolean {
    return this.actualizandoIds().has(productoId);
  }

  direccionSeleccionada(): DireccionGuardada | null {
    return this.direcciones().find(
      (direccion) => direccion.id === this.checkoutForm.controls.direccionId.value,
    ) ?? null;
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(precioCent / 100);
  }

  private limpiarActualizando(productoId: string): void {
    this.actualizandoIds.update((ids) => {
      const restantes = new Set(ids);
      restantes.delete(productoId);
      return restantes;
    });
  }

  private mensajeParaError(error: HttpErrorResponse): string {
    if (error.status === 0) return 'No se puede conectar con el servidor. Inténtalo de nuevo.';
    if (error.status === 401) return 'Tu sesión ha caducado. Inicia sesión de nuevo para consultar la cesta.';
    if (error.status === 403) return 'Solo los clientes pueden consultar y modificar su cesta.';
    if (error.status === 404) return 'No se ha encontrado el carrito o el producto que intentas modificar.';
    if (error.status === 400) return 'La cantidad indicada no es válida.';
    return `No se ha podido actualizar el carrito (HTTP ${error.status}).`;
  }
}
