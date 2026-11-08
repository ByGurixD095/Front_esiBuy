import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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

  readonly items = signal<ItemCarrito[]>([]);
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
  readonly pedidoPendientePago = signal<PedidoCreado | null>(null);
  readonly pedidoConfirmado = signal<PedidoCreado | null>(null);
  readonly cantidadUnidades = computed(() => this.items().reduce((total, item) => total + item.cantidad, 0));
  readonly totalCentimos = computed(() =>
    this.items().reduce((total, item) => total + item.precioCent * item.cantidad, 0),
  );

  readonly checkoutForm = new FormGroup({
    metodoPagoId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direccionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.cargarCarrito();
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('continuarPedido') === 'true') {
        this.metodoPagoPreferido = params.get('metodoPagoId');
        this.direccionPreferida = params.get('direccionId');
        this.abrirCheckout();
      }
    });
  }

  cargarCarrito(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.carritoService.obtenerCarrito().subscribe({
      next: (items) => {
        this.items.set(items);
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

  cargarMetodosPago(): void {
    this.cargandoMetodosPago.set(true);
    this.errorMetodosPago.set('');
    this.metodosPagoService.listar().subscribe({
      next: (metodos) => {
        this.metodosPago.set(metodos);
        const metodoPreferido = metodos.find((metodo) => metodo.id === this.metodoPagoPreferido);
        const metodoActual = metodos.find((metodo) => metodo.id === this.checkoutForm.controls.metodoPagoId.value);
        this.checkoutForm.controls.metodoPagoId.setValue(metodoPreferido?.id ?? metodoActual?.id ?? metodos[0]?.id ?? '');
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
        const direccionPreferida = direcciones.find((direccion) => direccion.id === this.direccionPreferida);
        const direccionActual = direcciones.find(
          (direccion) => direccion.id === this.checkoutForm.controls.direccionId.value,
        );
        this.checkoutForm.controls.direccionId.setValue(
          direccionPreferida?.id ?? direccionActual?.id ?? direcciones[0]?.id ?? '',
        );
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

  confirmarPedido(): void {
    if (this.creandoPedido()) return;
    if (this.checkoutForm.invalid || this.metodosPago().length === 0 || this.direcciones().length === 0) {
      this.checkoutForm.markAllAsTouched();
      this.errorPedido.set('Selecciona una dirección guardada y un método de pago.');
      return;
    }

    const valores = this.checkoutForm.getRawValue();
    const direccion = this.direcciones().find((item) => item.id === valores.direccionId);
    if (!direccion) {
      this.errorPedido.set('La dirección seleccionada ya no está disponible. Actualiza la lista.');
      return;
    }
    const datos: CrearPedidoRequest = {
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
    this.pedidosService.crear(datos).subscribe({
      next: (pedido) => {
        this.pedidoPendientePago.set(pedido);
        this.items.set([]);
        this.creandoPedido.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorPedido.set(
          error.status === 409
            ? 'Ha cambiado la disponibilidad de algún producto. Hemos ajustado la cesta al stock disponible; revísala antes de volver a intentarlo.'
            : this.auth.errorMessage(error, 'No se ha podido realizar el pedido. Revisa la cesta e inténtalo de nuevo.'),
        );
        this.creandoPedido.set(false);
        if (error.status === 409) this.cargarCarrito();
      },
    });
  }

  confirmarPago(): void {
    const pedido = this.pedidoPendientePago();
    if (!pedido || this.procesandoPago()) return;

    this.procesandoPago.set(true);
    this.errorPago.set('');
    this.pedidosService.pagar(pedido.id).subscribe({
      next: (pedidoPagado) => {
        this.pedidoConfirmado.set(pedidoPagado);
        this.pedidoPendientePago.set(null);
        this.procesandoPago.set(false);
        this.checkoutAbierto.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.procesandoPago.set(false);
        if (error.status === 409) {
          this.pedidoPendientePago.set(null);
          this.errorPago.set(
            'No se pudo completar el pago dentro del plazo. Hemos actualizado el carrito; revísalo antes de realizar otro pedido.',
          );
          this.cargarCarrito();
        } else {
          this.errorPago.set(
            this.auth.errorMessage(error, 'No se ha podido confirmar el pago simulado. Puedes volver a intentarlo.'),
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
    if (error.status === 403) return 'El servidor ha rechazado la petición (403). Comprueba tus permisos y el token de seguridad.';
    if (error.status === 404) return 'No se ha encontrado el carrito o el producto que intentas modificar.';
    if (error.status === 400) return 'La cantidad indicada no es válida.';
    return `No se ha podido actualizar el carrito (HTTP ${error.status}).`;
  }
}
