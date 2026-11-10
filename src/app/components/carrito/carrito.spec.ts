import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';
import { DireccionGuardada, DireccionesService } from '../../services/direcciones.service';
import { MetodoPago, MetodosPagoService } from '../../services/metodos-pago-service/metodos-pago';
import { PedidosService } from '../../services/pedidos.service';
import { Carrito } from './carrito';

describe('Carrito', () => {
  let fixture: ComponentFixture<Carrito>;
  const carritoFalso = {
    obtenerCarrito: vi.fn(),
    anadirProducto: vi.fn(),
    actualizarCantidad: vi.fn(),
    eliminarProducto: vi.fn(),
    vaciar: vi.fn(),
  };
  const direccionesFalso = { listar: vi.fn() };
  const metodosPagoFalso = { listar: vi.fn() };
  const pedidosFalso = { crear: vi.fn(), pagar: vi.fn(), listarActivos: vi.fn() };
  const authFalso = {
    isAuthenticated: () => true,
    hasRole: () => true,
    errorMessage: (_error: unknown, fallback: string) => fallback,
  };

  async function crear(items: ItemCarrito[]): Promise<void> {
    carritoFalso.obtenerCarrito.mockReturnValue(of(items));
    await TestBed.configureTestingModule({
      imports: [Carrito],
      providers: [
        provideRouter([]),
        { provide: CarritoService, useValue: carritoFalso },
        { provide: DireccionesService, useValue: direccionesFalso },
        { provide: MetodosPagoService, useValue: metodosPagoFalso },
        { provide: PedidosService, useValue: pedidosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Carrito);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    carritoFalso.obtenerCarrito.mockReset();
    carritoFalso.actualizarCantidad.mockReset().mockReturnValue(of(undefined));
    carritoFalso.anadirProducto.mockReset().mockReturnValue(of(undefined));
    carritoFalso.eliminarProducto.mockReset();
    carritoFalso.vaciar.mockReset();
    carritoFalso.vaciar.mockReturnValue(of(undefined));
    direccionesFalso.listar.mockReset();
    direccionesFalso.listar.mockReturnValue(of([]));
    metodosPagoFalso.listar.mockReset();
    metodosPagoFalso.listar.mockReturnValue(of([]));
    pedidosFalso.crear.mockReset();
    pedidosFalso.pagar.mockReset();
    pedidosFalso.listarActivos.mockReset();
  });

  it('muestra un estado informativo y enlace al catálogo con la cesta vacía', async () => {
    await crear([]);

    expect(html().textContent).toContain('Tu cesta está vacía');
    expect(html().querySelector('a[href="/products"]')).not.toBeNull();
  });

  it('muestra los artículos y calcula cantidad y subtotal', async () => {
    await crear([
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 2 },
      { productoId: 'p2', nombre: 'Cuaderno', precioCent: 500, urlImagen: 'cuaderno.jpg', cantidad: 1 },
    ]);

    expect(html().textContent).toContain('Mochila');
    expect(html().textContent).toContain('Cuaderno');
    expect(html().textContent).toContain('3 unidades');
    expect(html().textContent).toContain('56,98');
  });

  it('persiste un cambio de cantidad y actualiza el subtotal', async () => {
    carritoFalso.actualizarCantidad.mockReturnValue(of(undefined));
    await crear([
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 1 },
    ]);

    html().querySelector<HTMLButtonElement>('[aria-label="Aumentar cantidad de Mochila"]')?.click();
    fixture.detectChanges();

    expect(carritoFalso.actualizarCantidad).toHaveBeenCalledWith('p1', 2);
    expect(html().textContent).toContain('51,98');
  });

  it('vacía toda la cesta solo después de confirmar', async () => {
    carritoFalso.vaciar.mockReturnValue(of(undefined));
    await crear([{ productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 1 }]);

    fixture.componentInstance.solicitarVaciado();
    fixture.detectChanges();
    expect(carritoFalso.vaciar).not.toHaveBeenCalled();

    fixture.componentInstance.confirmarVaciado();
    fixture.detectChanges();

    expect(carritoFalso.vaciar).toHaveBeenCalledOnce();
    expect(html().textContent).toContain('Tu cesta está vacía');
  });

  it('muestra la ventana de confirmación y elimina el producto al confirmar', async () => {
    carritoFalso.eliminarProducto.mockReturnValue(of(undefined));
    await crear([
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 2 },
    ]);

    html().querySelector<HTMLButtonElement>('[aria-label="Eliminar Mochila del carrito"]')?.click();
    fixture.detectChanges();

    expect(html().textContent).toContain(
      '¿Está seguro de que quiere eliminar Mochila del carrito?',
    );
    expect(carritoFalso.eliminarProducto).not.toHaveBeenCalled();

    html().querySelector<HTMLButtonElement>('.confirm-remove-button')?.click();
    fixture.detectChanges();

    expect(carritoFalso.eliminarProducto).toHaveBeenCalledWith('p1');
    expect(html().textContent).toContain('Tu cesta está vacía');
  });

  it('mantiene el producto si se cancela la ventana de confirmación', async () => {
    await crear([
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 1 },
    ]);

    html().querySelector<HTMLButtonElement>('[aria-label="Eliminar Mochila del carrito"]')?.click();
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.cancel-button')?.click();
    fixture.detectChanges();

    expect(carritoFalso.eliminarProducto).not.toHaveBeenCalled();
    expect(html().textContent).toContain('Mochila');
    expect(html().querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('envía la dirección y el método de pago y muestra la confirmación del pedido', async () => {
    const metodo: MetodoPago = {
      id: 'pago-1',
      tipo: 'TARJETA',
      alias: 'Visa personal',
      referencia: '**** 1234',
    };
    const direccion: DireccionGuardada = {
      id: 'direccion-1',
      nombreCompleto: 'Ana García',
      direccion: 'Calle Mayor 1',
      ciudad: 'Madrid',
      provincia: 'Madrid',
      codigoPostal: '28001',
      pais: 'España',
      telefono: '+34600000000',
    };
    metodosPagoFalso.listar.mockReturnValue(of([metodo]));
    direccionesFalso.listar.mockReturnValue(of([direccion]));
    pedidosFalso.crear.mockReturnValue(of({ id: 'pedido-1', totalCent: 5698, estado: 'EN_PROCESO' }));
    pedidosFalso.pagar.mockReturnValue(of({ id: 'pedido-1', totalCent: 5698, estado: 'PAGADO' }));
    await crear([
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 2 },
      { productoId: 'p2', nombre: 'Cuaderno', precioCent: 500, urlImagen: null, cantidad: 1 },
    ]);

    fixture.componentInstance.abrirCheckout();
    fixture.componentInstance.checkoutForm.setValue({
      metodoPagoId: 'pago-1',
      direccionId: 'direccion-1',
    });
    await fixture.componentInstance.confirmarPedido();
    fixture.detectChanges();

    expect(pedidosFalso.crear).toHaveBeenCalledWith({
      metodoPagoId: 'pago-1',
      direccionEnvio: {
        nombreCompleto: direccion.nombreCompleto,
        direccion: direccion.direccion,
        ciudad: direccion.ciudad,
        provincia: direccion.provincia,
        codigoPostal: direccion.codigoPostal,
        pais: direccion.pais,
        telefono: direccion.telefono,
      },
    });
    expect(html().textContent).toContain('Confirmación de pago');
    expect(pedidosFalso.pagar).not.toHaveBeenCalled();

    fixture.componentInstance.confirmarPago();
    fixture.detectChanges();

    expect(pedidosFalso.pagar).toHaveBeenCalledWith('pedido-1');
    expect(html().textContent).toContain('¡Pago confirmado!');
    expect(fixture.componentInstance.pedidoConfirmado()).toBe(true);
    expect(fixture.componentInstance.pedidosPendientesPago()).toHaveLength(0);
    expect(html().textContent).not.toContain('Mochila');
  });

  it('no envía el pedido con datos de envío incompletos', async () => {
    metodosPagoFalso.listar.mockReturnValue(
      of([{ id: 'pago-1', tipo: 'TARJETA', alias: 'Visa personal', referencia: '**** 1234' }]),
    );
    direccionesFalso.listar.mockReturnValue(of([]));
    await crear([{ productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 1 }]);

    fixture.componentInstance.abrirCheckout();
    fixture.componentInstance.confirmarPedido();
    fixture.detectChanges();

    expect(pedidosFalso.crear).not.toHaveBeenCalled();
    expect(html().textContent).toContain('Selecciona una dirección guardada');
    expect(html().textContent).toContain('Mochila');
  });

  it('si el pago vence, borra los pedidos pendientes y actualiza la cesta', async () => {
    const metodo: MetodoPago = {
      id: 'pago-1',
      tipo: 'TARJETA',
      alias: 'Visa personal',
      referencia: '**** 1234',
    };
    const direccion: DireccionGuardada = {
      id: 'direccion-1',
      nombreCompleto: 'Ana García',
      direccion: 'Calle Mayor 1',
      ciudad: 'Madrid',
      provincia: 'Madrid',
      codigoPostal: '28001',
      pais: 'España',
      telefono: '+34600000000',
    };
    metodosPagoFalso.listar.mockReturnValue(of([metodo]));
    direccionesFalso.listar.mockReturnValue(of([direccion]));
    pedidosFalso.crear.mockReturnValue(of({ id: 'pedido-1', totalCent: 100, estado: 'EN_PROCESO' }));
    pedidosFalso.pagar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await crear([{ productoId: 'p1', nombre: 'Mochila', precioCent: 100, urlImagen: null, cantidad: 1 }]);
    carritoFalso.obtenerCarrito.mockClear();

    fixture.componentInstance.abrirCheckout();
    fixture.componentInstance.checkoutForm.setValue({
      metodoPagoId: 'pago-1',
      direccionId: 'direccion-1',
    });
    await fixture.componentInstance.confirmarPedido();
    expect(fixture.componentInstance.pedidosPendientesPago()).toHaveLength(1);

    carritoFalso.obtenerCarrito.mockClear();
    fixture.componentInstance.confirmarPago();
    fixture.detectChanges();

    expect(fixture.componentInstance.pedidosPendientesPago()).toHaveLength(0);
    expect(fixture.componentInstance.errorPago()).toContain('dentro del plazo');
    expect(carritoFalso.obtenerCarrito).toHaveBeenCalledOnce();
  });
});
